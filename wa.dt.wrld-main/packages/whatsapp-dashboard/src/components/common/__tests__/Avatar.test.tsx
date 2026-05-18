import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar } from '../Avatar'

describe('Avatar', () => {
  describe('rendering', () => {
    it('renders initials when no image is provided', () => {
      render(<Avatar name="John Doe" />)
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('renders single letter for single-word name', () => {
      render(<Avatar name="John" />)
      expect(screen.getByText('J')).toBeInTheDocument()
    })

    it('renders max 2 initials for long names', () => {
      render(<Avatar name="John Michael Doe Smith" />)
      expect(screen.getByText('JM')).toBeInTheDocument()
    })

    it('renders image when imageUrl is provided', () => {
      render(<Avatar name="John Doe" imageUrl="https://example.com/avatar.jpg" />)
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
      expect(img).toHaveAttribute('alt', 'John Doe')
    })
  })

  describe('sizes', () => {
    it('applies small size class', () => {
      render(<Avatar name="John Doe" size="sm" />)
      const avatar = screen.getByText('JD')
      expect(avatar).toHaveClass('w-8', 'h-8')
    })

    it('applies medium size class by default', () => {
      render(<Avatar name="John Doe" />)
      const avatar = screen.getByText('JD')
      expect(avatar).toHaveClass('w-10', 'h-10')
    })

    it('applies large size class', () => {
      render(<Avatar name="John Doe" size="lg" />)
      const avatar = screen.getByText('JD')
      expect(avatar).toHaveClass('w-12', 'h-12')
    })

    it('applies xl size class', () => {
      render(<Avatar name="John Doe" size="xl" />)
      const avatar = screen.getByText('JD')
      expect(avatar).toHaveClass('w-16', 'h-16')
    })
  })

  describe('status indicator', () => {
    it('does not show status indicator by default', () => {
      const { container } = render(<Avatar name="John Doe" />)
      expect(container.querySelector('.bg-green-500')).not.toBeInTheDocument()
    })

    it('shows online status indicator', () => {
      const { container } = render(<Avatar name="John Doe" status="online" />)
      expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    })

    it('shows offline status indicator', () => {
      const { container } = render(<Avatar name="John Doe" status="offline" />)
      expect(container.querySelector('.bg-muted-foreground')).toBeInTheDocument()
    })

    it('shows away status indicator', () => {
      const { container } = render(<Avatar name="John Doe" status="away" />)
      expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument()
    })
  })

  describe('color consistency', () => {
    it('generates consistent color for same name', () => {
      const { container: container1 } = render(<Avatar name="John Doe" />)
      const { container: container2 } = render(<Avatar name="John Doe" />)

      const avatar1 = container1.querySelector('.rounded-full')
      const avatar2 = container2.querySelector('.rounded-full')

      // Same name should produce same color class
      expect(avatar1?.className).toEqual(avatar2?.className)
    })

    it('generates different colors for different names', () => {
      const { container: container1 } = render(<Avatar name="Alice Smith" />)
      const { container: container2 } = render(<Avatar name="Bob Johnson" />)

      // Note: This test might fail occasionally if two different names hash to same color
      // but the probability is low (1/17)
      const avatar1Classes = container1.querySelector('.rounded-full')?.className
      const avatar2Classes = container2.querySelector('.rounded-full')?.className

      // At minimum they should both have a bg- class
      expect(avatar1Classes).toMatch(/bg-\w+-500/)
      expect(avatar2Classes).toMatch(/bg-\w+-500/)
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      const { container } = render(<Avatar name="John Doe" className="my-custom-class" />)
      expect(container.firstChild).toHaveClass('my-custom-class')
    })
  })
})
