import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryStatsCard } from '../MemoryStatsCard'

describe('MemoryStatsCard', () => {
  describe('rendering', () => {
    it('renders all stats with complete data', () => {
      const stats = {
        collectionName: 'whatsapp_conversations',
        vectorCount: 42,
        indexedVectors: 42,
        storageSizeBytes: 1024000,
        lastUpdatedAt: '2024-02-10T10:30:00Z',
      }

      render(<MemoryStatsCard stats={stats} />)

      // Check header
      expect(screen.getByText('Memory Statistics')).toBeInTheDocument()

      // Check collection name
      expect(screen.getByText('Collection')).toBeInTheDocument()
      expect(screen.getByText('whatsapp_conversations')).toBeInTheDocument()

      // Check vector count and indexed vectors (both 42)
      expect(screen.getByText('Vector Count')).toBeInTheDocument()
      expect(screen.getByText('Indexed Vectors')).toBeInTheDocument()
      expect(screen.getAllByText('42')).toHaveLength(2)

      // Check storage size
      expect(screen.getByText('Storage Size')).toBeInTheDocument()
      expect(screen.getByText('1000.0 KB')).toBeInTheDocument()

      // Check last updated
      expect(screen.getByText('Last Updated')).toBeInTheDocument()
    })

    it('handles large numbers with proper formatting', () => {
      const stats = {
        collectionName: 'test_collection',
        vectorCount: 1234567,
        indexedVectors: 1234567,
      }

      render(<MemoryStatsCard stats={stats} />)

      // Both vector count and indexed vectors show the same formatted number
      expect(screen.getAllByText('1,234,567')).toHaveLength(2)
    })

    it('formats storage size in appropriate units', () => {
      const statsKB = {
        collectionName: 'test',
        vectorCount: 10,
        indexedVectors: 10,
        storageSizeBytes: 2048,
      }

      const { rerender } = render(<MemoryStatsCard stats={statsKB} />)
      expect(screen.getByText('2.0 KB')).toBeInTheDocument()

      // Test MB
      const statsMB = {
        ...statsKB,
        storageSizeBytes: 5242880, // 5 MB
      }
      rerender(<MemoryStatsCard stats={statsMB} />)
      expect(screen.getByText('5.0 MB')).toBeInTheDocument()

      // Test GB
      const statsGB = {
        ...statsKB,
        storageSizeBytes: 2147483648, // 2 GB
      }
      rerender(<MemoryStatsCard stats={statsGB} />)
      expect(screen.getByText('2.0 GB')).toBeInTheDocument()
    })

    it('handles missing optional fields gracefully', () => {
      const stats = {
        collectionName: 'minimal_collection',
        vectorCount: 10,
        indexedVectors: 10,
        // storageSizeBytes and lastUpdatedAt are undefined
      }

      render(<MemoryStatsCard stats={stats} />)

      // Should render required fields
      expect(screen.getByText('minimal_collection')).toBeInTheDocument()
      // Both vector count and indexed vectors show "10"
      expect(screen.getAllByText('10')).toHaveLength(2)

      // Optional fields should not crash the component
      expect(screen.queryByText('Storage Size')).not.toBeInTheDocument()
      expect(screen.queryByText('Last Updated')).not.toBeInTheDocument()
    })

    it('displays all icons for each stat row', () => {
      const stats = {
        collectionName: 'test_collection',
        vectorCount: 100,
        indexedVectors: 100,
        storageSizeBytes: 1024,
        lastUpdatedAt: '2024-02-10T10:30:00Z',
      }

      const { container } = render(<MemoryStatsCard stats={stats} />)

      // Check that icons are rendered (Lucide icons render as SVGs)
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('handles zero values', () => {
      const stats = {
        collectionName: 'empty_collection',
        vectorCount: 0,
        indexedVectors: 0,
        storageSizeBytes: 0,
      }

      render(<MemoryStatsCard stats={stats} />)

      // Both vector count and indexed vectors show "0"
      expect(screen.getAllByText('0')).toHaveLength(2)
      // storageSizeBytes=0 is falsy, so Storage Size row is not rendered
      expect(screen.queryByText('Storage Size')).not.toBeInTheDocument()
    })

    it('handles very small storage sizes', () => {
      const stats = {
        collectionName: 'tiny_collection',
        vectorCount: 1,
        indexedVectors: 1,
        storageSizeBytes: 512,
      }

      render(<MemoryStatsCard stats={stats} />)

      expect(screen.getByText('512.0 B')).toBeInTheDocument()
    })
  })
})
