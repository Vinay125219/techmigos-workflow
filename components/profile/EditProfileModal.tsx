import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, X, Camera, Upload, Loader2, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/utils/imageUtils';
import { Slider } from '@/components/ui/slider';

const COMMON_DESIGNATIONS = [
  'Software Engineer',
  'Senior Developer',
  'Tech Lead',
  'Product Manager',
  'Designer',
  'DevOps Engineer',
  'QA Engineer',
  'Data Analyst'
];

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
  'Design', 'UI/UX', 'Database', 'DevOps', 'Testing'
];

interface EditProfileModalProps {
  trigger?: React.ReactNode;
}

export function EditProfileModal({ trigger }: EditProfileModalProps) {
  const { profile, updateProfile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Cropper State
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setDesignation((profile as any).designation || '');
      setDepartment(profile.department || '');
      setSkills(profile.skills || []);
      setAvatarUrl(profile.avatar_url || null);
      setPreviewUrl(profile.avatar_url || null);
    }
  }, [profile, open]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Error', description: 'Image must be less than 5MB', variant: 'destructive' });
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setTempImageSrc(reader.result as string);
        setShowCropper(true);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      });
      reader.readAsDataURL(file);
    }
    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;

    try {
      setUploadingPhoto(true);
      const croppedImageBlob = await getCroppedImg(tempImageSrc, croppedAreaPixels);

      if (!croppedImageBlob || !user) {
        throw new Error('Could not crop image');
      }

      // Convert blob to file
      const fileName = `${user.id}/avatar-${Date.now()}.jpg`;
      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' });

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      setPreviewUrl(publicUrl);
      setShowCropper(false);
      setTempImageSrc(null);

      toast({ title: 'Photo updated!', description: 'Don\'t forget to click Save Changes.' });
    } catch (e: any) {
      console.error('Crop/Upload error:', e);
      // Detailed error message
      const errorMessage = e.message || 'Unknown error occurred';
      if (errorMessage.includes('Could not crop')) {
        toast({ title: 'Cropping Failed', description: 'Could not process the image. Try a different one.', variant: 'destructive' });
      } else {
        toast({ title: 'Upload Failed', description: errorMessage, variant: 'destructive' });
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }

    setLoading(true);

    const { error } = await updateProfile({
      full_name: fullName.trim(),
      designation: designation.trim() || null,
      department: department.trim() || null,
      skills,
      avatar_url: avatarUrl,
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Profile updated successfully!' });
      setOpen(false);
    }
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  // If showing cropper, render just the cropper UI
  if (showCropper && tempImageSrc) {
    return (
      <Dialog open={open} onOpenChange={(val) => {
        if (!val) setShowCropper(false);
        setOpen(val);
      }}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust Profile Photo</DialogTitle>
          </DialogHeader>

          <div className="relative w-full h-80 bg-black/5 rounded-md overflow-hidden mt-2">
            <Cropper
              image={tempImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              showGrid={false}
              cropShape="round"
            />
          </div>

          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(vals) => setZoom(vals[0])}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCropper(false);
                  setTempImageSrc(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCropSave} disabled={uploadingPhoto}>
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Set Profile Photo
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Settings className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Photo Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-accent/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-info flex items-center justify-center text-2xl font-bold text-white">
                  {initials}
                </div>
              )}
              {/* Upload overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className={cn(
                  "absolute inset-0 rounded-full flex items-center justify-center",
                  "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                  uploadingPhoto && "opacity-100"
                )}
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              <Upload className="w-4 h-4 mr-2" />
              Change Photo
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation / Role</Label>
            <Input
              id="designation"
              placeholder="e.g., Senior Developer"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {COMMON_DESIGNATIONS.filter(d => d !== designation).slice(0, 4).map((d) => (
                <Badge
                  key={d}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary text-xs"
                  onClick={() => setDesignation(d)}
                >
                  {d}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="e.g., Engineering"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(newSkill);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addSkill(newSkill)}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingPhoto}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
