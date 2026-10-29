import type { ReactNode } from 'react';
import BackButton from '../../shared/components/BackButton';

export function WorkspaceLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <BackButton />
      <div>
        <p className="eyebrow">Persistent workspace</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function RecordList({ records, empty }: { records: ReactNode[]; empty: string }) {
  return records.length === 0 ? <p className="text-sm text-surface-400 py-4 text-center">{empty}</p> : <ul className="divide-y divide-white/5">{records}</ul>;
}
