import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderPlus,
  FolderMinus,
  Search,
  Activity,
  Layers,
  Clock,
  Code2,
  Terminal,
  Variable,
  Info,
  ChevronRight,
  X,
} from 'lucide-react';
import { CallGraphNode } from '../lisp/types';

interface CallGraphVisualizerProps {
  rootNode: CallGraphNode | null;
  onSelectLine?: (line: number) => void;
}

export function CallGraphVisualizer({ rootNode, onSelectLine }: CallGraphVisualizerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedNode, setSelectedNode] = useState<CallGraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | null>(null);

  // Compute invocation tree statistics
  const stats = useMemo(() => {
    if (!rootNode) return { total: 0, maxDepth: 0, lambdas: 0, builtins: 0, scopes: 0 };
    let total = 0;
    let maxDepth = 0;
    let lambdas = 0;
    let builtins = 0;
    let scopes = 0;

    const traverse = (node: CallGraphNode) => {
      total++;
      if (node.depth > maxDepth) maxDepth = node.depth;
      if (node.type === 'lambda') lambdas++;
      else if (node.type === 'builtin') builtins++;
      else if (node.type === 'scope') scopes++;

      const children = node.children || node._children || [];
      children.forEach(traverse);
    };

    traverse(rootNode);
    return { total, maxDepth, lambdas, builtins, scopes };
  }, [rootNode]);

  // D3 Tree Rendering and Interaction
  useEffect(() => {
    if (!rootNode || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'main-group');

    // Setup Zoom & Pan behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomTransform(event.transform);
      });

    svg.call(zoom);

    // Initial center transform
    const initialTransform = d3.zoomIdentity.translate(80, height / 2).scale(0.85);
    svg.call(zoom.transform, initialTransform);

    // Clone tree so user interactions (collapse/expand) don't mutate original root
    const rootData = JSON.parse(JSON.stringify(rootNode)) as CallGraphNode;

    // D3 Hierarchy
    const root = d3.hierarchy<CallGraphNode>(rootData, (d) => d.children);
    (root as any).x0 = 0;
    (root as any).y0 = 0;

    // Tree layout (horizontal orientation: x is vertical, y is horizontal)
    const nodeWidth = 220;
    const nodeHeight = 54;
    const treeLayout = d3.tree<CallGraphNode>().nodeSize([nodeHeight, nodeWidth]);

    let i = 0;

    function update(source: any) {
      const treeData = treeLayout(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      // Normalize for fixed depth spacing
      nodes.forEach((d) => {
        d.y = d.depth * 200;
      });

      // --- NODES ---
      const node = g.selectAll<SVGGElement, d3.HierarchyNode<CallGraphNode>>('g.node')
        .data(nodes, (d: any) => d.id || (d.id = ++i));

      // Enter any new nodes at the parent's previous position
      const nodeEnter = node
        .enter()
        .append('g')
        .attr('class', 'node cursor-pointer')
        .attr('transform', () => `translate(${source.y0},${source.x0})`)
        .on('click', (event, d) => {
          // Toggle children on click
          if (d.children) {
            d.data._children = d.data.children;
            (d as any)._children = d.children;
            d.children = null;
            d.data.children = [];
          } else if ((d as any)._children) {
            d.children = (d as any)._children;
            d.data.children = d.data._children || [];
            (d as any)._children = null;
            d.data._children = undefined;
          }
          setSelectedNode(d.data);
          update(d);
        });

      // Node background card (rounded pill / rectangle)
      nodeEnter
        .append('rect')
        .attr('class', 'node-box')
        .attr('width', 170)
        .attr('height', 38)
        .attr('x', -10)
        .attr('y', -19)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', (d) => {
          if (d.data.type === 'program') return '#064e3b'; // emerald
          if (d.data.type === 'lambda') return '#3b0764'; // purple
          if (d.data.type === 'builtin') return '#083344'; // cyan
          if (d.data.type === 'scope') return '#451a03'; // amber
          return '#0f172a';
        })
        .attr('stroke', (d) => {
          if (d.data.type === 'program') return '#10b981';
          if (d.data.type === 'lambda') return '#a855f7';
          if (d.data.type === 'builtin') return '#06b6d4';
          if (d.data.type === 'scope') return '#f59e0b';
          return '#64748b';
        })
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', (d) => (d.data.type === 'scope' ? '3,3' : 'none'));

      // Node type indicator badge (small circle on left edge)
      nodeEnter
        .append('circle')
        .attr('cx', -10)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', (d) => {
          if (d.data.type === 'program') return '#10b981';
          if (d.data.type === 'lambda') return '#c084fc';
          if (d.data.type === 'builtin') return '#22d3ee';
          if (d.data.type === 'scope') return '#fbbf24';
          return '#94a3b8';
        });

      // Expand/Collapse toggle badge on right edge if node has children
      nodeEnter
        .append('circle')
        .attr('class', 'collapse-toggle')
        .attr('cx', 160)
        .attr('cy', 0)
        .attr('r', 7)
        .attr('fill', '#1e293b')
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1)
        .style('display', (d) => (d.children || (d as any)._children ? 'block' : 'none'));

      nodeEnter
        .append('text')
        .attr('class', 'collapse-sign')
        .attr('x', 160)
        .attr('y', 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none')
        .text((d) => ((d as any)._children ? '+' : d.children ? '−' : ''))
        .style('display', (d) => (d.children || (d as any)._children ? 'block' : 'none'));

      // Function name text
      nodeEnter
        .append('text')
        .attr('class', 'node-title')
        .attr('x', 4)
        .attr('y', -3)
        .attr('fill', '#f1f5f9')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'monospace')
        .text((d) => {
          const name = d.data.name;
          return name.length > 15 ? name.slice(0, 14) + '…' : name;
        });

      // Arguments / Return preview subtitle
      nodeEnter
        .append('text')
        .attr('class', 'node-sub')
        .attr('x', 4)
        .attr('y', 11)
        .attr('fill', '#94a3b8')
        .attr('font-size', '9.5px')
        .attr('font-family', 'monospace')
        .text((d) => {
          if (d.data.type === 'scope') return 'scope transition';
          const argsStr = d.data.args.join(', ');
          const preview = `(${argsStr.length > 12 ? argsStr.slice(0, 11) + '…' : argsStr})`;
          const ret = d.data.returnValue !== undefined ? ` => ${d.data.returnValue}` : '';
          const full = `${preview}${ret}`;
          return full.length > 20 ? full.slice(0, 19) + '…' : full;
        });

      // Duration badge on top right
      nodeEnter
        .append('text')
        .attr('class', 'node-time')
        .attr('x', 152)
        .attr('y', -6)
        .attr('text-anchor', 'end')
        .attr('fill', '#64748b')
        .attr('font-size', '8.5px')
        .attr('font-family', 'monospace')
        .text((d) => (d.data.durationMs > 0 ? `${d.data.durationMs}ms` : ''));

      // UPDATE transition
      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate
        .transition()
        .duration(300)
        .attr('transform', (d) => `translate(${d.y},${d.x})`);

      // Update collapse sign
      nodeUpdate
        .select('.collapse-sign')
        .text((d) => ((d as any)._children ? '+' : d.children ? '−' : ''));

      nodeUpdate
        .select('.collapse-toggle')
        .style('display', (d) => (d.children || (d as any)._children ? 'block' : 'none'));

      // Highlight matching search term or selected node
      nodeUpdate.select('rect.node-box').attr('stroke', (d) => {
        if (selectedNode?.id === d.data.id) return '#fbbf24'; // selected: amber glow
        if (searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return '#38bdf8'; // search hit: sky blue
        }
        if (d.data.type === 'program') return '#10b981';
        if (d.data.type === 'lambda') return '#a855f7';
        if (d.data.type === 'builtin') return '#06b6d4';
        if (d.data.type === 'scope') return '#f59e0b';
        return '#64748b';
      }).attr('stroke-width', (d) => (selectedNode?.id === d.data.id || (searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase())) ? 2.5 : 1.5));

      // EXIT transition
      node
        .exit()
        .transition()
        .duration(300)
        .attr('transform', () => `translate(${source.y},${source.x})`)
        .remove();

      // --- LINKS (Bezier curves between invocations) ---
      const link = g.selectAll<SVGPathElement, d3.HierarchyLink<CallGraphNode>>('path.link')
        .data(links, (d: any) => d.target.id);

      const linkEnter = link
        .enter()
        .insert('path', 'g')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.6)
        .attr('d', () => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal(o, o);
        });

      linkEnter.merge(link).transition().duration(300).attr('d', (d) => diagonal(d.source, d.target));

      link
        .exit()
        .transition()
        .duration(300)
        .attr('d', () => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      // Store current positions for smooth transitions next update
      nodes.forEach((d: any) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    function diagonal(s: any, d: any) {
      return `M ${s.y + 160} ${s.x}
              C ${(s.y + 160 + d.y - 10) / 2} ${s.x},
                ${(s.y + 160 + d.y - 10) / 2} ${d.x},
                ${d.y - 10} ${d.x}`;
    }

    // Collapse deeper levels by default (depth > 2) to keep large trees readable
    function collapseDeepNodes(d: any) {
      if (d.children) {
        d.children.forEach(collapseDeepNodes);
        if (d.depth >= 2) {
          d._children = d.children;
          d.children = null;
        }
      }
    }
    collapseDeepNodes(root);

    update(root);
  }, [rootNode, searchTerm, selectedNode]);

  // Zoom control helpers
  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(250).call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !containerRef.current) return;
    const height = containerRef.current.clientHeight || 600;
    const svg = d3.select(svgRef.current);
    const initialTransform = d3.zoomIdentity.translate(80, height / 2).scale(0.85);
    svg.transition().duration(350).call(d3.zoom<SVGSVGElement, unknown>().transform as any, initialTransform);
  };

  if (!rootNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#0b0f19] text-slate-400 font-mono">
        <Activity size={36} className="text-slate-600 mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-slate-200">No Call Graph Generated Yet</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Run your OmniLisp program using <strong>'Build & Run'</strong> or <strong>'Step Debug'</strong> to record function invocations, parameter passing, and scope transitions.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0f19] text-slate-200 select-none overflow-hidden relative font-sans">
      {/* Visualizer Toolbar */}
      <div className="h-10 border-b border-slate-800 bg-slate-900/90 px-3 flex items-center justify-between shrink-0 text-xs font-mono">
        {/* Left: Summary Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Activity size={13} className="text-indigo-400" />
            <span className="font-semibold text-slate-100">{stats.total}</span>
            <span className="text-slate-500 text-[11px]">invocations</span>
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-purple-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              {stats.lambdas} lambdas
            </span>
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              {stats.builtins} built-ins
            </span>
            {stats.scopes > 0 && (
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {stats.scopes} scopes
              </span>
            )}
            <span className="text-slate-500">Max Depth: {stats.maxDepth}</span>
          </div>
        </div>

        {/* Right: Search & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Find function..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded pl-6 pr-2 py-0.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-32"
            />
          </div>

          <div className="w-px h-4 bg-slate-800" />

          {/* Zoom controls */}
          <button
            onClick={() => handleZoom(1.25)}
            title="Zoom In"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            title="Zoom Out"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            title="Fit to Screen"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Graph Area + Node Detail Inspector Drawer */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Legend Overlay at bottom-left */}
        <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-xs border border-slate-800 rounded-md p-2 flex items-center gap-3 text-[10px] font-mono text-slate-400 pointer-events-none">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Program Root</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Lambda Call</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Built-in Procedure</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Scope Transition</span>
          </div>
        </div>

        {/* Node Inspection Drawer (When a node is clicked) */}
        {selectedNode && (
          <div className="absolute top-3 right-3 w-80 max-h-[85%] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-4 flex flex-col gap-3 font-mono text-xs overflow-y-auto animate-in slide-in-from-right-4 duration-150 z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    selectedNode.type === 'program'
                      ? 'bg-emerald-400'
                      : selectedNode.type === 'lambda'
                      ? 'bg-purple-400'
                      : selectedNode.type === 'builtin'
                      ? 'bg-cyan-400'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="font-semibold text-slate-100 text-sm">{selectedNode.name}</span>
                <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {selectedNode.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>

            {/* Performance & Source Info */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Execution Time</span>
                <span className="text-indigo-300 font-semibold">{selectedNode.durationMs} ms</span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Source Line</span>
                {selectedNode.line ? (
                  <span
                    onClick={() => onSelectLine?.(selectedNode.line!)}
                    className="text-amber-400 font-semibold cursor-pointer hover:underline"
                  >
                    Line {selectedNode.line}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">inline / host</span>
                )}
              </div>
            </div>

            {/* Arguments Passed */}
            <div>
              <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                Arguments Passed ({selectedNode.args.length})
              </span>
              {selectedNode.args.length > 0 ? (
                <div className="flex flex-col gap-1 p-2 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px] overflow-x-auto">
                  {selectedNode.args.map((arg, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-slate-600 select-none">arg[{idx}]:</span>
                      <span className="text-slate-200">{arg}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-600 italic text-[11px] p-2 bg-slate-950/40 rounded">
                  No arguments passed
                </div>
              )}
            </div>

            {/* Return Value */}
            <div>
              <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                Return Value
              </span>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-emerald-300 text-[11px] overflow-x-auto break-all">
                {selectedNode.returnValue !== undefined ? selectedNode.returnValue : 'undefined'}
              </div>
            </div>

            {/* Scope Variables Snapshot */}
            {selectedNode.scopeVars && Object.keys(selectedNode.scopeVars).length > 0 && (
              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                  Scope Variables Snapshot
                </span>
                <div className="flex flex-col gap-1 p-2 rounded bg-slate-950 border border-slate-800 text-[11px]">
                  {Object.entries(selectedNode.scopeVars).map(([vName, vVal]) => (
                    <div key={vName} className="flex items-center justify-between gap-2">
                      <span className="text-indigo-400 font-semibold">{vName}:</span>
                      <span className="text-slate-300 truncate max-w-[150px]">{vVal}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
