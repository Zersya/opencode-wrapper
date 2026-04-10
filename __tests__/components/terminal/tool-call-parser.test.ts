import { parseToolCalls, parseStructuredToolCalls, mergeToolCallSegments, getToolIcon, TOOL_ICONS, ToolCall } from '../../components/terminal/tool-call-parser'

describe('tool-call-parser', () => {
  describe('getToolIcon', () => {
    it('should return icon for exact tool name match', () => {
      expect(getToolIcon('read')).toBe('📄')
      expect(getToolIcon('bash')).toBe('💻')
      expect(getToolIcon('webfetch')).toBe('🌐')
    })

    it('should return icon for underscore variations', () => {
      expect(getToolIcon('read_file')).toBe('📄')
      expect(getToolIcon('write_file')).toBe('📝')
    })

    it('should return icon for partial matches', () => {
      expect(getToolIcon('my_read_function')).toBe('📄')
      expect(getToolIcon('bash_script')).toBe('💻')
    })

    it('should return default icon for unknown tools', () => {
      expect(getToolIcon('unknown_tool')).toBe('🔧')
      expect(getToolIcon('xyz')).toBe('🔧')
    })
  })

  describe('parseToolCalls', () => {
    it('should parse simple tool invocation', () => {
      const output = '▶ read\nfilePath: /test.txt'
      const segments = parseToolCalls(output)
      
      expect(segments).toHaveLength(1)
      expect(segments[0].type).toBe('tool_call')
      expect(segments[0].toolCall?.toolName).toBe('read')
      expect(segments[0].toolCall?.arguments).toEqual({ filePath: '/test.txt' })
    })

    it('should parse multiple tool calls', () => {
      const output = `
▶ read
filePath: /file1.txt

Some output text

▶ edit
filePath: /file2.txt
`.trim()
      
      const segments = parseToolCalls(output)
      
      expect(segments.filter(s => s.type === 'tool_call')).toHaveLength(2)
    })

    it('should parse tool with completion marker', () => {
      const output = `
▶ read
filePath: /test.txt
✓ completed
`.trim()
      
      const segments = parseToolCalls(output)
      const toolCall = segments.find(s => s.type === 'tool_call')?.toolCall
      
      expect(toolCall?.status).toBe('completed')
    })

    it('should parse tool with failure marker', () => {
      const output = `
▶ read
filePath: /missing.txt
✗ failed
`.trim()
      
      const segments = parseToolCalls(output)
      const toolCall = segments.find(s => s.type === 'tool_call')?.toolCall
      
      expect(toolCall?.status).toBe('failed')
    })

    it('should capture tool result', () => {
      const output = `
▶ read
filePath: /test.txt
---
This is the file content
More content here
✓ done
`.trim()
      
      const segments = parseToolCalls(output)
      const toolCall = segments.find(s => s.type === 'tool_call')?.toolCall
      
      expect(toolCall?.result).toContain('This is the file content')
      expect(toolCall?.status).toBe('completed')
    })

    it('should handle mixed text and tool calls', () => {
      const output = `
Starting execution...

▶ bash
command: ls -la

file1.txt
file2.txt

✓ completed

More text after the tool call
`.trim()
      
      const segments = parseToolCalls(output)
      
      expect(segments[0].type).toBe('text')
      expect(segments[1].type).toBe('tool_call')
      expect(segments[2].type).toBe('text')
    })

    it('should recognize different invocation markers', () => {
      const markers = ['▶', '>', '●', '▸', '→']
      
      markers.forEach(marker => {
        const output = `${marker} read`
        const segments = parseToolCalls(output)
        expect(segments[0].type).toBe('tool_call')
        expect(segments[0].toolCall?.toolName).toBe('read')
      })
    })

    it('should parse modern OpenCode tool names', () => {
      const output = `
▶ augment_context_engine_codebase_retrieval
information_request: Find auth files

▶ context7_resolve_library_id
libraryName: nextjs

▶ task
description: Analyze codebase
`.trim()
      
      const segments = parseToolCalls(output)
      const toolCalls = segments.filter(s => s.type === 'tool_call')
      
      expect(toolCalls).toHaveLength(3)
      expect(toolCalls[0].toolCall?.toolName).toBe('augment_context_engine_codebase_retrieval')
      expect(toolCalls[1].toolCall?.toolName).toBe('context7_resolve_library_id')
      expect(toolCalls[2].toolCall?.toolName).toBe('task')
    })

    it('should handle code blocks without parsing as tools', () => {
      const output = `
Here's some code:

\`\`\`typescript
const x = 1;
const y = 2;
\`\`\`

End of code block
`.trim()
      
      const segments = parseToolCalls(output)
      
      // Should be all text, no tool calls
      expect(segments.every(s => s.type === 'text')).toBe(true)
    })
  })

  describe('parseStructuredToolCalls', () => {
    it('should parse structured tool call events', () => {
      const events = [
        {
          type: 'tool_call',
          tool: 'read',
          arguments: { filePath: '/test.txt' },
          status: 'completed',
          result: 'File content here'
        }
      ]
      
      const segments = parseStructuredToolCalls(events)
      
      expect(segments).toHaveLength(1)
      expect(segments[0].toolCall?.toolName).toBe('read')
      expect(segments[0].toolCall?.status).toBe('completed')
      expect(segments[0].toolCall?.result).toBe('File content here')
    })

    it('should handle non-string arguments', () => {
      const events = [
        {
          type: 'tool_call',
          tool: 'read',
          arguments: { 
            filePath: '/test.txt',
            options: { encoding: 'utf8' },
            count: 5
          }
        }
      ]
      
      const segments = parseStructuredToolCalls(events)
      const args = segments[0].toolCall?.arguments
      
      expect(args?.filePath).toBe('/test.txt')
      expect(args?.options).toBe('{"encoding":"utf8"}')
      expect(args?.count).toBe('5')
    })
  })

  describe('mergeToolCallSegments', () => {
    it('should parse fresh when no existing segments', () => {
      const newOutput = '▶ read\nfilePath: /test.txt'
      const segments = mergeToolCallSegments([], newOutput)
      
      expect(segments).toHaveLength(1)
      expect(segments[0].type).toBe('tool_call')
    })

    it('should merge with existing running tool', () => {
      const existingSegments = [
        { type: 'text', content: 'Starting...' },
        { 
          type: 'tool_call', 
          toolCall: {
            id: '1',
            toolName: 'read',
            status: 'running' as const,
            arguments: { filePath: '/test.txt' },
            startTime: Date.now(),
            result: 'Partial'
          } as ToolCall
        }
      ]
      
      const newOutput = ' result output'
      const segments = mergeToolCallSegments(existingSegments, newOutput)
      
      // Should have tool call with merged result
      const toolCall = segments.find(s => s.type === 'tool_call')?.toolCall
      expect(toolCall?.result).toContain('Partial result output')
    })
  })

  describe('TOOL_ICONS', () => {
    it('should have at least 30 tool icons', () => {
      const iconCount = Object.keys(TOOL_ICONS).length
      expect(iconCount).toBeGreaterThanOrEqual(30)
    })

    it('should cover all major tool categories', () => {
      const expectedCategories = [
        'read', 'write', 'bash', 'grep', 'search',
        'codebase_retrieval', 'context7_resolve_library_id',
        'webfetch', 'task', 'skill', 'ask'
      ]
      
      expectedCategories.forEach(tool => {
        expect(getToolIcon(tool)).not.toBe('🔧') // Should not return default
      })
    })
  })
})
