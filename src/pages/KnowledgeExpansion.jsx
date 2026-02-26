import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from '../components/layout/AppHeader';
import { PageContainer } from '../components/ui';
import KnowledgeDashboard from '../modules/knowledge-expansion/KnowledgeDashboard';

export default function KnowledgeExpansion() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Productive Calendar"
        subtitle="Knowledge Expansion"
        onLogout={() => { logout(); navigate('/login'); }}
      />
      <PageContainer>
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-6">
          <KnowledgeDashboard />
        </section>
      </PageContainer>
    </div>
  );
}
