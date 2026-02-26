import React from 'react';
import { Input, Select } from '../../components/ui';
import { SOURCE_TYPES } from '../../services/knowledgeService';
import { Search, X } from 'lucide-react';

export default function KnowledgeFilters({ filters, setFilter, clearFilters }) {
  return (
    <section className="mb-6 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[180px] max-w-xs flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
        <Input
          placeholder="Search title & content..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="pl-9"
        />
      </div>
      <Input
        type="date"
        value={filters.startDate}
        onChange={(e) => setFilter('startDate', e.target.value)}
        className="w-40"
      />
      <Input
        type="date"
        value={filters.endDate}
        onChange={(e) => setFilter('endDate', e.target.value)}
        className="w-40"
      />
      <Input
        placeholder="Tag"
        value={filters.tag}
        onChange={(e) => setFilter('tag', e.target.value)}
        className="w-32"
      />
      <Select
        value={filters.sourceType}
        onChange={(e) => setFilter('sourceType', e.target.value)}
        className="w-36"
      >
        <option value="">All sources</option>
        {SOURCE_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </Select>
      <Select
        value={filters.ratingMin}
        onChange={(e) => setFilter('ratingMin', e.target.value)}
        className="w-28"
      >
        <option value="">Any rating</option>
        {[1, 2, 3, 4, 5].map((r) => (
          <option key={r} value={r}>{r}+ stars</option>
        ))}
      </Select>
      {clearFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-ui border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-text-muted hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      )}
    </section>
  );
}
