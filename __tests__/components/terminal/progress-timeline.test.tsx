import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProgressTimeline } from '../../components/terminal/progress-timeline'
import { ExecutionPhase, formatElapsedTime } from '../../lib/terminal/progress-types'

describe('ProgressTimeline', () => {
  const defaultProps = {
    phase: 'initializing' as ExecutionPhase,
    progressPercent: 0,
    elapsedMs: 0
  }

  it('should render without crashing', () => {
    render(<ProgressTimeline {...defaultProps} />)
    expect(screen.getByText(/Initializing/i)).toBeInTheDocument()
  })

  it('should display all phase labels', () => {
    render(<ProgressTimeline {...defaultProps} />)
    
    const phases = ['Setup', 'Clone', 'Session', 'Analyze', 'Plan', 'Execute', 'Process', 'Finalize']
    phases.forEach(phase => {
      expect(screen.getByText(new RegExp(phase, 'i'))).toBeInTheDocument()
    })
  })

  it('should highlight current phase', () => {
    render(<ProgressTimeline {...defaultProps} phase="executing" progressPercent={50} />)
    
    // The executing phase should be visually highlighted
    const executingPhase = screen.getByText(/Executing/i)
    expect(executingPhase).toBeInTheDocument()
  })

  it('should display progress bar', () => {
    render(<ProgressTimeline {...defaultProps} progressPercent={45} />)
    
    // Progress percentage should be visible
    expect(screen.getByText(/45%/)).toBeInTheDocument()
  })

  it('should display elapsed time', () => {
    render(<ProgressTimeline {...defaultProps} elapsedMs={125000} />) // 2m 5s
    
    expect(screen.getByText(/2m 5s/)).toBeInTheDocument()
  })

  it('should display current tool when provided', () => {
    render(
      <ProgressTimeline 
        {...defaultProps} 
        phase="executing" 
        currentTool="read"
        progressPercent={30}
      />
    )
    
    expect(screen.getByText(/read/)).toBeInTheDocument()
  })

  it('should handle 100% progress', () => {
    render(<ProgressTimeline {...defaultProps} phase="finalizing" progressPercent={100} />)
    
    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('should format milliseconds correctly', () => {
    expect(formatElapsedTime(500)).toBe('0s')
    expect(formatElapsedTime(5000)).toBe('5s')
    expect(formatElapsedTime(65000)).toBe('1m 5s')
    expect(formatElapsedTime(3665000)).toBe('61m 5s')
  })
})
