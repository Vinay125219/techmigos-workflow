"use client";

import { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

export default function Documents() {
  const { activeWorkspaceId } = useWorkspaceContext();
  const { isAuthenticated } = useAuth();
  const { documents, loading, uploadDocument, deleteDocument } = useDocuments({ workspaceId: activeWorkspaceId });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast({ title: 'Validation error', description: 'Title and file are required', variant: 'destructive' });
      return;
    }

    const { error } = await uploadDocument({
      file,
      title,
      description,
      workspaceId: activeWorkspaceId,
    });

    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Uploaded', description: 'Document uploaded with versioning enabled.' });
    setTitle('');
    setDescription('');
    setFile(null);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">Please sign in to view documents.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="text-muted-foreground">Upload task/project files with version tracking and ownership rules.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleUpload}><Upload className="w-4 h-4 mr-2" />Upload</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p>Loading...</p> : null}
            {documents.map((document) => (
              <div key={document.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {document.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{document.description || 'No description'}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">v{document.version}</Badge>
                    <Badge variant="outline">{Math.round(document.file_size / 1024)} KB</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={document.file_url} target="_blank" rel="noreferrer">Preview</a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { error } = await deleteDocument(document);
                      if (error) {
                        toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
                        return;
                      }
                      toast({ title: 'Deleted', description: 'Document removed.' });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!loading && documents.length === 0 ? (
              <p className="text-muted-foreground">No documents uploaded yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
