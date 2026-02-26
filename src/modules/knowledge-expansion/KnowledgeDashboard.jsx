import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import KnowledgeStats from './KnowledgeStats';
import KnowledgeFilters from './KnowledgeFilters';
import KnowledgeCard from './KnowledgeCard';
import AddKnowledgeModal from './AddKnowledgeModal';
import ViewKnowledgeModal from './ViewKnowledgeModal';
import { useKnowledge } from './useKnowledge';
import { Button } from '../../components/ui';

export default function KnowledgeDashboard() {
  const {
    entries,
    totalCount,
    stats,
    loading,
    saving,
    error,
    filters,
    setFilter,
    clearFilters,
    hasMore,
    loadMore,
    addOrUpdateEntry,
    removeEntry,
  } = useKnowledge();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [viewEntry, setViewEntry] = useState(null);

  const handleCardClick = useCallback(async (entry) => {
    setViewEntry(entry);
    setViewModalOpen(true);
  }, []);

  const handleEditFromView = useCallback((entry) => {
    setViewModalOpen(false);
    setEditingEntry(entry);
    setAddModalOpen(true);
  }, []);

  const handleCloseAdd = useCallback(() => {
    setAddModalOpen(false);
    setEditingEntry(null);
  }, []);

  const handleSave = useCallback(
    async (payload) => {
      await addOrUpdateEntry(payload);
      handleCloseAdd();
    },
    [addOrUpdateEntry, handleCloseAdd]
  );

  const handleDeleteFromView = useCallback(
    async (id) => {
      await removeEntry(id);
      setViewModalOpen(false);
      setViewEntry(null);
    },
    [removeEntry]
  );

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Knowledge Expansion</h1>
        <p className="mt-1 text-sm text-app-text-muted">
          Your structured learning journal. Add what you learn, tag it, and build a second brain.
        </p>
      </header>

      <KnowledgeStats stats={stats} />

      <KnowledgeFilters
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <section className="relative">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {entries.map((entry) => (
                  <KnowledgeCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => handleCardClick(entry)}
                  />
                ))}
              </AnimatePresence>
            </div>
            {entries.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-dashed border-white/10 bg-white/5 py-12 text-center text-app-text-muted"
              >
                <p>No entries yet. Add your first learning.</p>
                <Button
                  className="mt-4"
                  onClick={() => setAddModalOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add entry
                </Button>
              </motion.div>
            )}
            {hasMore && entries.length > 0 && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={loadMore} disabled={loading}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Floating add button (mobile-friendly) */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8"
        >
          <Button
            size="lg"
            onClick={() => {
              setEditingEntry(null);
              setAddModalOpen(true);
            }}
            className="rounded-full bg-violet-600 px-5 py-3 shadow-lg shadow-violet-500/25 hover:bg-violet-500"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      <AddKnowledgeModal
        open={addModalOpen}
        onClose={handleCloseAdd}
        entryToEdit={editingEntry}
        onSave={handleSave}
        saving={saving}
      />

      <ViewKnowledgeModal
        open={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setViewEntry(null); }}
        entry={viewEntry}
        onEdit={handleEditFromView}
        onDelete={handleDeleteFromView}
      />
    </>
  );
}
