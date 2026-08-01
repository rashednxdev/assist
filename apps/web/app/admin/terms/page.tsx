'use client';

import { useEffect, useState } from 'react';
import type { ExplanationSection, TermsRecord } from '@ibas/shared-types';
import { emptyExplanationSection } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { ExplanationSectionsEditor } from '@/components/questions/explanation-sections-editor';

export default function TermsAdminPage() {
  const [header, setHeader] = useState('');
  const [sections, setSections] = useState<ExplanationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: TermsRecord }>('/terms');
      setHeader(res.data.header);
      setSections(res.data.sections.length > 0 ? res.data.sections : [emptyExplanationSection()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await apiFetch<{ data: TermsRecord }>('/terms', {
        method: 'PUT',
        body: JSON.stringify({ header, sections }),
      });
      setSections(res.data.sections.length > 0 ? res.data.sections : [emptyExplanationSection()]);
      setMessage('Terms and Conditions saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Terms & Conditions"
        description="Shown to every user before they can register a new account. Add one or more titled sections."
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Header</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Label htmlFor="terms-header">Page heading</Label>
              <Input
                id="terms-header"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder="e.g. Terms and Conditions"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sections</CardTitle>
            </CardHeader>
            <CardContent>
              <ExplanationSectionsEditor sections={sections} onChange={setSections} disabled={saving} />
            </CardContent>
          </Card>

          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving...' : 'Save Terms & Conditions'}
          </Button>
        </>
      )}
    </div>
  );
}
