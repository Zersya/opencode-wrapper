import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallCard } from '../../components/terminal/tool-call-card'
import type { ToolCall } from '../../components/terminal/tool-call-parser'

describe('ToolCallCard', () => {
  const createToolCall = (overrides: Partial<ToolCall> = {}): ToolCall => ({
    id: 'test-1',
    toolName: 'read',
    status: 'completed',
    arguments: { filePath: '/test.txt' },
    result: 'File content',
    duration: '1.2s',
    startTime: Date.now(),
    ...overrides
  })

  it('should render with basic tool call', () => {
    const toolCall = createToolCall()
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/Read/i)).toBeInTheDocument()
    expect(screen.getByText(/Completed/i)).toBeInTheDocument()
  })

  it('should display running status', () => {
    const toolCall = createToolCall({ status: 'running' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/Running/i)).toBeInTheDocument()
  })

  it('should display failed status', () => {
    const toolCall = createToolCall({ status: 'failed', result: 'Error: File not found' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/Failed/i)).toBeInTheDocument()
  })

  it('should display arguments', () => {
    const toolCall = createToolCall({
      arguments: { 
        filePath: '/long/path/to/file.txt',
        encoding: 'utf8'
      }
    })
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/filePath:/i)).toBeInTheDocument()
    expect(screen.getByText(/encoding:/i)).toBeInTheDocument()
  })

  it('should display result when expanded', () => {
    const toolCall = createToolCall({ result: 'This is the file content' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    // Expand the card
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    expect(screen.getByText(/This is the file content/i)).toBeInTheDocument()
  })

  it('should show live indicator when isLive is true', () => {
    const toolCall = createToolCall({ status: 'running' })
    render(<ToolCallCard toolCall={toolCall} isLive={true} />)
    
    expect(screen.getByText(/Live/i)).toBeInTheDocument()
  })

  it('should show duration when available', () => {
    const toolCall = createToolCall({ duration: '2.5s' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/2.5s/)).toBeInTheDocument()
  })

  it('should copy result to clipboard', async () => {
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined)
    }
    Object.assign(navigator, { clipboard: mockClipboard })
    
    const toolCall = createToolCall({ result: 'Content to copy' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    const copyButton = screen.getByRole('button', { name: /copy result/i })
    fireEvent.click(copyButton)
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith('Content to copy')
  })

  it('should handle long tool names', () => {
    const toolCall = createToolCall({ toolName: 'augment_context_engine_codebase_retrieval' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/Augment/i)).toBeInTheDocument()
  })

  it('should handle tools without result', () => {
    const toolCall = createToolCall({ result: undefined })
    render(<ToolCallCard toolCall={toolCall} />)
    
    // Should render without errors
    expect(screen.getByText(/Read/i)).toBeInTheDocument()
    expect(screen.getByText(/Completed/i)).toBeInTheDocument()
  })

  it('should format tool name correctly', () => {
    const toolCall = createToolCall({ toolName: 'read_file' })
    render(<ToolCallCard toolCall={toolCall} />)
    
    expect(screen.getByText(/Read File/i)).toBeInTheDocument()
  })

  it('should handle code results', () => {
    const toolCall = createToolCall({ 
      result: '```typescript\nconst x = 1;\n```'
    })
    render(<ToolCallCard toolCall={toolCall} />)
    
    // Should indicate it's a code result
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    expect(screen.getByText(/Code/i)).toBeInTheDocument()
  })

  it('should handle file path results', () => {
    const toolCall = createToolCall({ 
      result: '/path/to/file.txt'
    })
    render(<ToolCallCard toolCall={toolCall} />)
    
    const expandButton = screen.getByRole('button', { name: /expand/i })
    fireEvent.click(expandButton)
    
    expect(screen.getByText(/File Path/i)).toBeInTheDocument()
  })
})
