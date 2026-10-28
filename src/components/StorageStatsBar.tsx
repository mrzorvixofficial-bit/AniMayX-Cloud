import React from 'react';
import {
  Layers,
  Image,
  Film,
  Music,
  FileText,
  Archive,
} from 'lucide-react';
import { StorageStats, FileCategory } from '../types.ts';
import { playClickSound } from '../utils/sound.ts';

interface StorageStatsBarProps {
  stats: StorageStats | null;
  activeCategory: FileCategory;
  onSelectCategory: (category: FileCategory) => void;
}

export const StorageStatsBar: React.FC<StorageStatsBarProps> = ({
  stats,
  activeCategory,
  onSelectCategory,
}) => {
  const categories: {
    id: FileCategory;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'all', name: 'All Files', icon: Layers, count: stats?.file_count },
    { id: 'image', name: 'Images', icon: Image, count: stats?.by_type.images.count },
    { id: 'video', name: 'Videos', icon: Film, count: stats?.by_type.videos.count },
    { id: 'audio', name: 'Audio', icon: Music, count: stats?.by_type.audio.count },
    { id: 'document', name: 'Documents', icon: FileText, count: stats?.by_type.documents.count },
    { id: 'archive', name: 'Archives', icon: Archive, count: stats?.by_type.archives.count },
  ];

  return (
    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => {
              playClickSound();
              onSelectCategory(cat.id);
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
              isActive
                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800/80'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-400' : 'text-zinc-400'}`} />
            <span>{cat.name}</span>
            {typeof cat.count === 'number' && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-orange-500/25 text-orange-300'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {cat.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
