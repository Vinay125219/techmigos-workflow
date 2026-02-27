#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${APPWRITE_DRY_RUN:-0}"

log() {
  printf '[appwrite-setup] %s\n' "$1"
}

print_cmd() {
  printf '  '
  printf '%q ' "$@"
  printf '\n'
}

is_truthy() {
  case "${1,,}" in
    1|true|yes|y) return 0 ;;
    *) return 1 ;;
  esac
}

load_env_file() {
  local file_path="$1"
  local allow_override="${2:-false}"

  [[ -f "$file_path" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local value="${BASH_REMATCH[2]}"

      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"

      if [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi

      if [[ "$allow_override" == "true" || -z "${!key:-}" ]]; then
        export "$key=$value"
      fi
    fi
  done < "$file_path"
}

capture_command() {
  local __result_var="$1"
  shift

  local captured_output
  local status
  set +e
  captured_output="$("$@" 2>&1)"
  status=$?
  set -e

  printf -v "$__result_var" '%s' "$captured_output"
  return "$status"
}

is_already_exists_error() {
  local text="$1"
  echo "$text" | grep -Eqi 'already exists|already in use|duplicate|conflict|must be unique'
}

is_retryable_schema_error() {
  local text="$1"
  echo "$text" | grep -Eqi 'not available|in progress|processing|attribute.+not found|index.+not found|resource is not ready|bad gateway|gateway timeout|service unavailable|internal server error|too many requests|timed out|first byte timeout|error 503|status 503'
}

load_cli_api_key_from_prefs() {
  local prefs_file="${HOME:-}/.appwrite/prefs.json"
  [[ -f "$prefs_file" ]] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  [[ -n "${APPWRITE_ENDPOINT:-}" ]] || return 1

  local detected_key=""
  detected_key="$(jq -r --arg endpoint "$APPWRITE_ENDPOINT" '
    to_entries[]
    | select((.value | type) == "object")
    | select(.value.endpoint == $endpoint and (.value.key // "") != "")
    | .value.key
  ' "$prefs_file" | head -n1)"

  [[ -n "$detected_key" && "$detected_key" != "null" ]] || return 1
  APPWRITE_API_KEY="$detected_key"
  export APPWRITE_API_KEY
  return 0
}

run_or_fail() {
  local description="$1"
  shift

  if is_truthy "$DRY_RUN"; then
    log "[dry-run] $description"
    print_cmd "$@"
    return 0
  fi

  local output
  if capture_command output "$@"; then
    log "[ok] $description"
    return 0
  fi

  log "[error] $description"
  printf '%s\n' "$output"
  return 1
}

run_allow_exists() {
  local description="$1"
  shift

  if is_truthy "$DRY_RUN"; then
    log "[dry-run] $description"
    print_cmd "$@"
    return 0
  fi

  local max_attempts=8
  local attempt=1
  local output=""
  while (( attempt <= max_attempts )); do
    if capture_command output "$@"; then
      log "[ok] $description"
      return 0
    fi

    if is_already_exists_error "$output"; then
      log "[skip] $description (already exists)"
      return 0
    fi

    if is_retryable_schema_error "$output"; then
      sleep 2
      attempt=$((attempt + 1))
      continue
    fi

    log "[error] $description"
    printf '%s\n' "$output"
    return 1
  done

  log "[error] $description (timed out)"
  printf '%s\n' "$output"
  return 1
}

run_retryable() {
  local description="$1"
  local max_attempts="$2"
  shift 2

  if is_truthy "$DRY_RUN"; then
    log "[dry-run] $description"
    print_cmd "$@"
    return 0
  fi

  local attempt=1
  local output=""
  while (( attempt <= max_attempts )); do
    if capture_command output "$@"; then
      log "[ok] $description"
      return 0
    fi

    if is_already_exists_error "$output"; then
      log "[skip] $description (already exists)"
      return 0
    fi

    if is_retryable_schema_error "$output"; then
      sleep 2
      attempt=$((attempt + 1))
      continue
    fi

    log "[error] $description"
    printf '%s\n' "$output"
    return 1
  done

  log "[error] $description (timed out)"
  printf '%s\n' "$output"
  return 1
}

create_collection() {
  local collection_id="$1"
  local collection_name="$2"
  shift 2

  local permissions=("$@")

  run_allow_exists \
    "Create collection ${collection_id}" \
    appwrite databases create-collection \
      --database-id "$APPWRITE_DATABASE_ID" \
      --collection-id "$collection_id" \
      --name "$collection_name" \
      --permissions "${permissions[@]}" \
      --document-security false \
      --enabled true

  run_retryable \
    "Apply permissions for collection ${collection_id}" \
    8 \
    appwrite databases update-collection \
      --database-id "$APPWRITE_DATABASE_ID" \
      --collection-id "$collection_id" \
      --name "$collection_name" \
      --permissions "${permissions[@]}" \
      --document-security false \
      --enabled true
}

create_index() {
  local collection_id="$1"
  local index_key="$2"
  local index_type="$3"
  shift 3

  run_retryable \
    "Create index ${collection_id}.${index_key}" \
    20 \
    appwrite databases create-index \
      --database-id "$APPWRITE_DATABASE_ID" \
      --collection-id "$collection_id" \
      --key "$index_key" \
      --type "$index_type" \
      --attributes "$@"
}

load_env_file "$ROOT_DIR/.env" false
load_env_file "$ROOT_DIR/.env.local" true

APPWRITE_ENDPOINT="${NEXT_PUBLIC_APPWRITE_ENDPOINT:-}"
APPWRITE_PROJECT_ID="${NEXT_PUBLIC_APPWRITE_PROJECT_ID:-}"
APPWRITE_PROJECT_NAME="${NEXT_PUBLIC_APPWRITE_PROJECT_NAME:-techmigos-web}"
APPWRITE_DATABASE_ID="${NEXT_PUBLIC_APPWRITE_DATABASE_ID:-}"

COL_PROFILES="${NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES:-profiles}"
COL_USER_ROLES="${NEXT_PUBLIC_APPWRITE_COLLECTION_USER_ROLES:-user_roles}"
COL_WORKSPACES="${NEXT_PUBLIC_APPWRITE_COLLECTION_WORKSPACES:-workspaces}"
COL_WORKSPACE_MEMBERS="${NEXT_PUBLIC_APPWRITE_COLLECTION_WORKSPACE_MEMBERS:-workspace_members}"
COL_PROJECTS="${NEXT_PUBLIC_APPWRITE_COLLECTION_PROJECTS:-projects}"
COL_TASKS="${NEXT_PUBLIC_APPWRITE_COLLECTION_TASKS:-tasks}"
COL_TASK_PROGRESS="${NEXT_PUBLIC_APPWRITE_COLLECTION_TASK_PROGRESS:-task_progress}"
COL_TASK_DEPENDENCIES="${NEXT_PUBLIC_APPWRITE_COLLECTION_TASK_DEPENDENCIES:-task_dependencies}"
COL_ACTIVITY_LOGS="${NEXT_PUBLIC_APPWRITE_COLLECTION_ACTIVITY_LOGS:-activity_logs}"
COL_NOTIFICATIONS="${NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATIONS:-notifications}"
COL_NOTIFICATION_PREFERENCES="${NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATION_PREFERENCES:-notification_preferences}"
COL_COMPANY_POLICY="${NEXT_PUBLIC_APPWRITE_COLLECTION_COMPANY_POLICY:-company_policy}"
COL_COMPANY_TRANSACTIONS="${NEXT_PUBLIC_APPWRITE_COLLECTION_COMPANY_TRANSACTIONS:-company_transactions}"
COL_IDEAS="${NEXT_PUBLIC_APPWRITE_COLLECTION_IDEAS:-ideas}"
COL_IDEA_VOTES="${NEXT_PUBLIC_APPWRITE_COLLECTION_IDEA_VOTES:-idea_votes}"
COL_DISCUSSIONS="${NEXT_PUBLIC_APPWRITE_COLLECTION_DISCUSSIONS:-discussions}"
COL_USER_ONBOARDING="${NEXT_PUBLIC_APPWRITE_COLLECTION_USER_ONBOARDING:-user_onboarding}"

BUCKET_AVATARS="${NEXT_PUBLIC_APPWRITE_BUCKET_AVATARS:-avatars}"
BUCKET_TASK_ATTACHMENTS="${NEXT_PUBLIC_APPWRITE_BUCKET_TASK_ATTACHMENTS:-task-attachments}"

if [[ -z "$APPWRITE_ENDPOINT" || -z "$APPWRITE_PROJECT_ID" || -z "$APPWRITE_DATABASE_ID" ]]; then
  log "Missing required env variables. Ensure these are set in .env/.env.local:"
  log "  NEXT_PUBLIC_APPWRITE_ENDPOINT"
  log "  NEXT_PUBLIC_APPWRITE_PROJECT_ID"
  log "  NEXT_PUBLIC_APPWRITE_DATABASE_ID"
  exit 1
fi

COLLECTION_PERMISSIONS=(
  'read("users")'
  'create("users")'
  'update("users")'
  'delete("users")'
)

BUCKET_PERMISSIONS=(
  'read("users")'
  'create("users")'
  'update("users")'
  'delete("users")'
)

if [[ -z "${APPWRITE_API_KEY:-}" ]] && ! is_truthy "$DRY_RUN"; then
  if load_cli_api_key_from_prefs; then
    log "Using API key from local Appwrite CLI preferences."
  fi
fi

log "Configuring CLI client for project ${APPWRITE_PROJECT_ID}"
client_cmd=(
  appwrite client
  --endpoint "$APPWRITE_ENDPOINT"
  --project-id "$APPWRITE_PROJECT_ID"
)
if [[ -n "${APPWRITE_API_KEY:-}" ]]; then
  client_cmd+=(--key "$APPWRITE_API_KEY")
fi
run_or_fail "Configure Appwrite CLI client" "${client_cmd[@]}"

if [[ -z "${APPWRITE_API_KEY:-}" ]] && ! is_truthy "$DRY_RUN"; then
  account_check_output=""
  if ! capture_command account_check_output appwrite account get; then
    log "No valid CLI session found for endpoint: ${APPWRITE_ENDPOINT}"
    log "Run the following command, then retry setup:"
    log "  appwrite login --endpoint \"${APPWRITE_ENDPOINT}\""
    log "Alternative for non-interactive/CI: export APPWRITE_API_KEY and rerun."
    printf '%s\n' "$account_check_output"
    exit 1
  fi
fi

run_allow_exists \
  "Create database ${APPWRITE_DATABASE_ID}" \
  appwrite databases create \
    --database-id "$APPWRITE_DATABASE_ID" \
    --name "$APPWRITE_DATABASE_ID" \
    --enabled true

create_collection "$COL_PROFILES" "Profiles" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_USER_ROLES" "User Roles" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_WORKSPACES" "Workspaces" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_WORKSPACE_MEMBERS" "Workspace Members" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_PROJECTS" "Projects" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_TASKS" "Tasks" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_TASK_PROGRESS" "Task Progress" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_TASK_DEPENDENCIES" "Task Dependencies" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_ACTIVITY_LOGS" "Activity Logs" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_NOTIFICATIONS" "Notifications" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_NOTIFICATION_PREFERENCES" "Notification Preferences" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_COMPANY_POLICY" "Company Policy" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_COMPANY_TRANSACTIONS" "Company Transactions" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_IDEAS" "Ideas" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_IDEA_VOTES" "Idea Votes" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_DISCUSSIONS" "Discussions" "${COLLECTION_PERMISSIONS[@]}"
create_collection "$COL_USER_ONBOARDING" "User Onboarding" "${COLLECTION_PERMISSIONS[@]}"

# profiles
run_allow_exists "profiles.email" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "email" --size 320 --required true
run_allow_exists "profiles.full_name" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "full_name" --size 255 --required true
run_allow_exists "profiles.avatar_url" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "avatar_url" --size 2048 --required false
run_allow_exists "profiles.department" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "department" --size 120 --required false
run_allow_exists "profiles.designation" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "designation" --size 120 --required false
run_allow_exists "profiles.skills" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "skills" --size 120 --required false --array true
run_allow_exists "profiles.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "created_at" --required true
run_allow_exists "profiles.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROFILES" --key "updated_at" --required true

# user_roles
run_allow_exists "user_roles.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ROLES" --key "user_id" --size 64 --required true
run_allow_exists "user_roles.role" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ROLES" --key "role" --elements admin manager member --required true
run_allow_exists "user_roles.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ROLES" --key "created_at" --required true

# workspaces
run_allow_exists "workspaces.name" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACES" --key "name" --size 255 --required true
run_allow_exists "workspaces.description" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACES" --key "description" --size 65535 --required false
run_allow_exists "workspaces.owner_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACES" --key "owner_id" --size 64 --required true
run_allow_exists "workspaces.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACES" --key "created_at" --required true
run_allow_exists "workspaces.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACES" --key "updated_at" --required true

# workspace_members
run_allow_exists "workspace_members.workspace_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACE_MEMBERS" --key "workspace_id" --size 64 --required true
run_allow_exists "workspace_members.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACE_MEMBERS" --key "user_id" --size 64 --required true
run_allow_exists "workspace_members.role" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACE_MEMBERS" --key "role" --elements owner admin member viewer --required true
run_allow_exists "workspace_members.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_WORKSPACE_MEMBERS" --key "created_at" --required true

# projects
run_allow_exists "projects.name" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "name" --size 255 --required true
run_allow_exists "projects.description" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "description" --size 65535 --required false
run_allow_exists "projects.status" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "status" --elements planned active completed on-hold --required true
run_allow_exists "projects.priority" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "priority" --elements low medium high critical --required true
run_allow_exists "projects.start_date" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "start_date" --required false
run_allow_exists "projects.end_date" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "end_date" --required false
run_allow_exists "projects.progress" appwrite databases create-integer-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "progress" --required false --min 0 --max 100 --xdefault 0
run_allow_exists "projects.category" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "category" --size 120 --required false
run_allow_exists "projects.workspace_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "workspace_id" --size 64 --required false
run_allow_exists "projects.created_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "created_by" --size 64 --required false
run_allow_exists "projects.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "created_at" --required true
run_allow_exists "projects.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_PROJECTS" --key "updated_at" --required true

# tasks
run_allow_exists "tasks.title" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "title" --size 255 --required true
run_allow_exists "tasks.description" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "description" --size 65535 --required false
run_allow_exists "tasks.status" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "status" --elements open in-progress review completed --required true
run_allow_exists "tasks.priority" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "priority" --elements low medium high critical --required true
run_allow_exists "tasks.difficulty" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "difficulty" --elements easy medium hard expert --required false
run_allow_exists "tasks.estimated_hours" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "estimated_hours" --required false --min 0
run_allow_exists "tasks.deadline" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "deadline" --required false
run_allow_exists "tasks.requirements" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "requirements" --size 65535 --required false
run_allow_exists "tasks.deliverables" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "deliverables" --size 65535 --required false
run_allow_exists "tasks.skills" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "skills" --size 120 --required false --array true
run_allow_exists "tasks.assigned_to" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "assigned_to" --size 64 --required false
run_allow_exists "tasks.project_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "project_id" --size 64 --required false
run_allow_exists "tasks.workspace_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "workspace_id" --size 64 --required false
run_allow_exists "tasks.created_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "created_by" --size 64 --required false
run_allow_exists "tasks.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "created_at" --required true
run_allow_exists "tasks.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASKS" --key "updated_at" --required true

# task_progress
run_allow_exists "task_progress.task_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "task_id" --size 64 --required true
run_allow_exists "task_progress.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "user_id" --size 64 --required true
run_allow_exists "task_progress.content" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "content" --size 65535 --required true
run_allow_exists "task_progress.hours_worked" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "hours_worked" --required false --min 0
run_allow_exists "task_progress.progress_percentage" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "progress_percentage" --required false --min 0 --max 100
run_allow_exists "task_progress.attachments" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "attachments" --size 2048 --required false --array true
run_allow_exists "task_progress.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_PROGRESS" --key "created_at" --required true

# task_dependencies
run_allow_exists "task_dependencies.task_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_DEPENDENCIES" --key "task_id" --size 64 --required true
run_allow_exists "task_dependencies.depends_on_task_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_DEPENDENCIES" --key "depends_on_task_id" --size 64 --required true
run_allow_exists "task_dependencies.dependency_type" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_DEPENDENCIES" --key "dependency_type" --elements blocks related --required true
run_allow_exists "task_dependencies.created_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_DEPENDENCIES" --key "created_by" --size 64 --required true
run_allow_exists "task_dependencies.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_TASK_DEPENDENCIES" --key "created_at" --required true

# activity_logs
run_allow_exists "activity_logs.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "user_id" --size 64 --required false
run_allow_exists "activity_logs.action_type" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "action_type" --size 80 --required true
run_allow_exists "activity_logs.entity_type" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "entity_type" --size 80 --required true
run_allow_exists "activity_logs.entity_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "entity_id" --size 64 --required true
run_allow_exists "activity_logs.entity_title" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "entity_title" --size 255 --required false
run_allow_exists "activity_logs.description" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "description" --size 65535 --required false
run_allow_exists "activity_logs.metadata" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "metadata" --size 65535 --required false
run_allow_exists "activity_logs.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_ACTIVITY_LOGS" --key "created_at" --required true

# notifications
run_allow_exists "notifications.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "user_id" --size 64 --required true
run_allow_exists "notifications.title" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "title" --size 255 --required true
run_allow_exists "notifications.message" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "message" --size 65535 --required true
run_allow_exists "notifications.type" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "type" --size 80 --required true
run_allow_exists "notifications.read" appwrite databases create-boolean-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "read" --required false --xdefault false
run_allow_exists "notifications.entity_type" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "entity_type" --size 80 --required false
run_allow_exists "notifications.entity_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "entity_id" --size 64 --required false
run_allow_exists "notifications.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATIONS" --key "created_at" --required true

# notification_preferences
run_allow_exists "notification_preferences.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "user_id" --size 64 --required true
run_allow_exists "notification_preferences.in_app_enabled" appwrite databases create-boolean-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "in_app_enabled" --required false --xdefault true
run_allow_exists "notification_preferences.email_enabled" appwrite databases create-boolean-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "email_enabled" --required false --xdefault false
run_allow_exists "notification_preferences.digest_enabled" appwrite databases create-boolean-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "digest_enabled" --required false --xdefault false
run_allow_exists "notification_preferences.muted_until" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "muted_until" --required false
run_allow_exists "notification_preferences.snoozed_until" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "snoozed_until" --required false
run_allow_exists "notification_preferences.type_preferences" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "type_preferences" --size 65535 --required false
run_allow_exists "notification_preferences.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "created_at" --required true
run_allow_exists "notification_preferences.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_NOTIFICATION_PREFERENCES" --key "updated_at" --required true

# company_policy
run_allow_exists "company_policy.access_mode" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_POLICY" --key "access_mode" --elements open allowlist --required true
run_allow_exists "company_policy.allowed_emails" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_POLICY" --key "allowed_emails" --size 320 --required false --array true
run_allow_exists "company_policy.updated_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_POLICY" --key "updated_by" --size 64 --required false
run_allow_exists "company_policy.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_POLICY" --key "created_at" --required true
run_allow_exists "company_policy.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_POLICY" --key "updated_at" --required true

# company_transactions
run_allow_exists "company_transactions.workspace_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "workspace_id" --size 64 --required false
run_allow_exists "company_transactions.project_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "project_id" --size 64 --required false
run_allow_exists "company_transactions.transaction_type" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "transaction_type" --elements income expense transfer salary refund reimbursement investment tax subscription invoice loan grant other --required false --xdefault other
run_retryable "company_transactions.transaction_type (update enum values)" 8 appwrite databases update-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "transaction_type" --elements income expense transfer salary refund reimbursement investment tax subscription invoice loan grant other --required false --xdefault other
run_allow_exists "company_transactions.settlement_status" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "settlement_status" --elements settled unsettled --required false --xdefault settled
run_retryable "company_transactions.settlement_status (update enum values)" 8 appwrite databases update-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "settlement_status" --elements settled unsettled --required false --xdefault settled
run_allow_exists "company_transactions.settled_on" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "settled_on" --size 32 --required false
run_allow_exists "company_transactions.category" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "category" --size 120 --required true
run_allow_exists "company_transactions.title" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "title" --size 255 --required true
run_allow_exists "company_transactions.description" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "description" --size 65535 --required false
run_allow_exists "company_transactions.amount" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "amount" --required true --min 0
run_allow_exists "company_transactions.actual_project_value" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "actual_project_value" --required false --min 0
run_allow_exists "company_transactions.advance_taken" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "advance_taken" --required false --min 0
run_allow_exists "company_transactions.team_member_count" appwrite databases create-integer-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "team_member_count" --required false --min 1
run_allow_exists "company_transactions.team_allocation_amount" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "team_allocation_amount" --required false --min 0
run_allow_exists "company_transactions.company_buffer_amount" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "company_buffer_amount" --required false --min 0
run_allow_exists "company_transactions.team_member_share" appwrite databases create-float-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "team_member_share" --required false --min 0
run_allow_exists "company_transactions.team_member_payouts_json" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "team_member_payouts_json" --size 65535 --required false
run_allow_exists "company_transactions.currency" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "currency" --size 10 --required true
run_allow_exists "company_transactions.transaction_date" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "transaction_date" --size 32 --required true
run_allow_exists "company_transactions.reference" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "reference" --size 255 --required false
run_allow_exists "company_transactions.paid_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "paid_by" --size 255 --required false
run_allow_exists "company_transactions.credited_to" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "credited_to" --size 255 --required false
run_allow_exists "company_transactions.proof_url" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "proof_url" --size 2048 --required false
run_allow_exists "company_transactions.proof_type" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "proof_type" --size 120 --required false
run_allow_exists "company_transactions.proof_name" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "proof_name" --size 255 --required false
run_allow_exists "company_transactions.created_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "created_by" --size 64 --required false
run_allow_exists "company_transactions.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "created_at" --required true
run_allow_exists "company_transactions.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_COMPANY_TRANSACTIONS" --key "updated_at" --required true

# ideas
run_allow_exists "ideas.title" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "title" --size 255 --required true
run_allow_exists "ideas.description" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "description" --size 65535 --required true
run_allow_exists "ideas.category" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "category" --size 120 --required false
run_allow_exists "ideas.status" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "status" --elements open under-review approved rejected implemented --required true
run_allow_exists "ideas.votes" appwrite databases create-integer-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "votes" --required false --xdefault 0
run_allow_exists "ideas.created_by" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "created_by" --size 64 --required false
run_allow_exists "ideas.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "created_at" --required true
run_allow_exists "ideas.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEAS" --key "updated_at" --required true

# idea_votes
run_allow_exists "idea_votes.idea_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEA_VOTES" --key "idea_id" --size 64 --required true
run_allow_exists "idea_votes.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEA_VOTES" --key "user_id" --size 64 --required true
run_allow_exists "idea_votes.vote_type" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEA_VOTES" --key "vote_type" --elements up down --required true
run_allow_exists "idea_votes.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_IDEA_VOTES" --key "created_at" --required true

# discussions
run_allow_exists "discussions.entity_type" appwrite databases create-enum-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "entity_type" --elements project task idea --required true
run_allow_exists "discussions.entity_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "entity_id" --size 64 --required true
run_allow_exists "discussions.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "user_id" --size 64 --required true
run_allow_exists "discussions.content" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "content" --size 65535 --required true
run_allow_exists "discussions.parent_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "parent_id" --size 64 --required false
run_allow_exists "discussions.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "created_at" --required true
run_allow_exists "discussions.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_DISCUSSIONS" --key "updated_at" --required true

# user_onboarding
run_allow_exists "user_onboarding.user_id" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ONBOARDING" --key "user_id" --size 64 --required true
run_allow_exists "user_onboarding.completed" appwrite databases create-boolean-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ONBOARDING" --key "completed" --required false --xdefault false
run_allow_exists "user_onboarding.steps_completed" appwrite databases create-string-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ONBOARDING" --key "steps_completed" --size 80 --required false --array true
run_allow_exists "user_onboarding.created_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ONBOARDING" --key "created_at" --required true
run_allow_exists "user_onboarding.updated_at" appwrite databases create-datetime-attribute --database-id "$APPWRITE_DATABASE_ID" --collection-id "$COL_USER_ONBOARDING" --key "updated_at" --required true

if ! is_truthy "$DRY_RUN"; then
  log "Waiting for collection attributes to finish processing..."
  sleep 6
fi

# indexes
create_index "$COL_PROFILES" "profiles_email" "key" "email"
create_index "$COL_PROFILES" "profiles_created_at" "key" "created_at"

create_index "$COL_USER_ROLES" "roles_user_id" "key" "user_id"
create_index "$COL_USER_ROLES" "roles_role" "key" "role"
create_index "$COL_USER_ROLES" "roles_user_role" "unique" "user_id" "role"

create_index "$COL_WORKSPACES" "workspaces_owner_id" "key" "owner_id"
create_index "$COL_WORKSPACES" "workspaces_created_at" "key" "created_at"

create_index "$COL_WORKSPACE_MEMBERS" "wm_workspace_id" "key" "workspace_id"
create_index "$COL_WORKSPACE_MEMBERS" "wm_user_id" "key" "user_id"
create_index "$COL_WORKSPACE_MEMBERS" "wm_created_at" "key" "created_at"
create_index "$COL_WORKSPACE_MEMBERS" "wm_workspace_user" "unique" "workspace_id" "user_id"

create_index "$COL_PROJECTS" "projects_workspace_id" "key" "workspace_id"
create_index "$COL_PROJECTS" "projects_created_by" "key" "created_by"
create_index "$COL_PROJECTS" "projects_created_at" "key" "created_at"

create_index "$COL_TASKS" "tasks_project_id" "key" "project_id"
create_index "$COL_TASKS" "tasks_workspace_id" "key" "workspace_id"
create_index "$COL_TASKS" "tasks_assigned_to" "key" "assigned_to"
create_index "$COL_TASKS" "tasks_status" "key" "status"
create_index "$COL_TASKS" "tasks_deadline" "key" "deadline"
create_index "$COL_TASKS" "tasks_created_at" "key" "created_at"
create_index "$COL_TASKS" "tasks_updated_at" "key" "updated_at"

create_index "$COL_TASK_PROGRESS" "tp_task_id" "key" "task_id"
create_index "$COL_TASK_PROGRESS" "tp_user_id" "key" "user_id"
create_index "$COL_TASK_PROGRESS" "tp_created_at" "key" "created_at"

create_index "$COL_TASK_DEPENDENCIES" "td_task_id" "key" "task_id"
create_index "$COL_TASK_DEPENDENCIES" "td_depends_on" "key" "depends_on_task_id"
create_index "$COL_TASK_DEPENDENCIES" "td_created_at" "key" "created_at"

create_index "$COL_ACTIVITY_LOGS" "al_user_id" "key" "user_id"
create_index "$COL_ACTIVITY_LOGS" "al_entity_type" "key" "entity_type"
create_index "$COL_ACTIVITY_LOGS" "al_created_at" "key" "created_at"

create_index "$COL_NOTIFICATIONS" "notifs_user_id" "key" "user_id"
create_index "$COL_NOTIFICATIONS" "notifs_read" "key" "read"
create_index "$COL_NOTIFICATIONS" "notifs_type" "key" "type"
create_index "$COL_NOTIFICATIONS" "notifs_entity_id" "key" "entity_id"
create_index "$COL_NOTIFICATIONS" "notifs_created_at" "key" "created_at"

create_index "$COL_NOTIFICATION_PREFERENCES" "np_user_id" "key" "user_id"
create_index "$COL_NOTIFICATION_PREFERENCES" "np_unique_user" "unique" "user_id"
create_index "$COL_NOTIFICATION_PREFERENCES" "np_updated_at" "key" "updated_at"

create_index "$COL_COMPANY_POLICY" "cp_mode" "key" "access_mode"
create_index "$COL_COMPANY_POLICY" "cp_updated_at" "key" "updated_at"

create_index "$COL_COMPANY_TRANSACTIONS" "ct_workspace_id" "key" "workspace_id"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_project_id" "key" "project_id"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_type" "key" "transaction_type"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_settlement_status" "key" "settlement_status"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_date" "key" "transaction_date"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_paid_by" "key" "paid_by"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_credited_to" "key" "credited_to"
create_index "$COL_COMPANY_TRANSACTIONS" "ct_created_at" "key" "created_at"

create_index "$COL_IDEAS" "ideas_created_by" "key" "created_by"
create_index "$COL_IDEAS" "ideas_votes" "key" "votes"
create_index "$COL_IDEAS" "ideas_status" "key" "status"
create_index "$COL_IDEAS" "ideas_created_at" "key" "created_at"

create_index "$COL_IDEA_VOTES" "iv_idea_id" "key" "idea_id"
create_index "$COL_IDEA_VOTES" "iv_user_id" "key" "user_id"
create_index "$COL_IDEA_VOTES" "iv_created_at" "key" "created_at"
create_index "$COL_IDEA_VOTES" "iv_idea_user" "unique" "idea_id" "user_id"

create_index "$COL_DISCUSSIONS" "dis_entity_type" "key" "entity_type"
create_index "$COL_DISCUSSIONS" "dis_entity_id" "key" "entity_id"
create_index "$COL_DISCUSSIONS" "dis_parent_id" "key" "parent_id"
create_index "$COL_DISCUSSIONS" "dis_created_at" "key" "created_at"

create_index "$COL_USER_ONBOARDING" "onboard_user_id" "key" "user_id"
create_index "$COL_USER_ONBOARDING" "onboard_unique_user" "unique" "user_id"

run_allow_exists \
  "Create bucket ${BUCKET_AVATARS}" \
  appwrite storage create-bucket \
    --bucket-id "$BUCKET_AVATARS" \
    --name "Avatars" \
    --permissions "${BUCKET_PERMISSIONS[@]}" \
    --file-security false \
    --enabled true \
    --maximum-file-size 10485760 \
    --compression none \
    --encryption true \
    --antivirus true \
    --transformations true

run_allow_exists \
  "Create bucket ${BUCKET_TASK_ATTACHMENTS}" \
  appwrite storage create-bucket \
    --bucket-id "$BUCKET_TASK_ATTACHMENTS" \
    --name "Task Attachments" \
    --permissions "${BUCKET_PERMISSIONS[@]}" \
    --file-security false \
    --enabled true \
    --maximum-file-size 31457280 \
    --compression none \
    --encryption true \
    --antivirus true \
    --transformations true

run_retryable \
  "Update bucket ${BUCKET_AVATARS} permissions" \
  8 \
  appwrite storage update-bucket \
    --bucket-id "$BUCKET_AVATARS" \
    --name "Avatars" \
    --permissions "${BUCKET_PERMISSIONS[@]}" \
    --file-security false \
    --enabled true \
    --maximum-file-size 10485760 \
    --compression none \
    --encryption true \
    --antivirus true \
    --transformations true

run_retryable \
  "Update bucket ${BUCKET_TASK_ATTACHMENTS} permissions" \
  8 \
  appwrite storage update-bucket \
    --bucket-id "$BUCKET_TASK_ATTACHMENTS" \
    --name "Task Attachments" \
    --permissions "${BUCKET_PERMISSIONS[@]}" \
    --file-security false \
    --enabled true \
    --maximum-file-size 31457280 \
    --compression none \
    --encryption true \
    --antivirus true \
    --transformations true

log "Provisioning finished for project ${APPWRITE_PROJECT_NAME} (${APPWRITE_PROJECT_ID})."
log "No Appwrite Cloud Function is required for current web adapter; auth/data logic is already integrated in the app."
