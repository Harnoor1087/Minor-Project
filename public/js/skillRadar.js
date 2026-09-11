/**
 * AIRIS - Interactive Skill Gap Radar Chart Component (D3.js)
 * Compares candidate competency profile against mandatory job requirements
 * and visually highlights improvement areas and actionable modifications.
 */

(function () {
  'use strict';

  // Role Skill Profiles & Benchmark Definitions
  const ROLE_DATA = {
    fullstack: {
      title: 'Full Stack Software Engineer',
      description: 'Candidate evaluated against Core Web Stack (Node.js, React, SQL & API Architecture).',
      skills: [
        {
          name: 'Core JavaScript/TS',
          required: 85,
          candidate: 85,
          improved: 92,
          gap: 0,
          recommendation: 'Proficiency meets senior expectations. Keep highlighting modern ES6+ and TypeScript types.'
        },
        {
          name: 'Node.js & Express',
          required: 85,
          candidate: 50,
          improved: 88,
          gap: -35,
          recommendation: 'Critical gap: Add asynchronous event-loop handling, Express middleware design, and streaming throughput metrics.'
        },
        {
          name: 'SQL & Data Persistence',
          required: 80,
          candidate: 45,
          improved: 82,
          gap: -35,
          recommendation: 'Mandatory prerequisite: Add PostgreSQL indexing, relation normalization, and migration strategies to resume.'
        },
        {
          name: 'React Architecture',
          required: 80,
          candidate: 88,
          improved: 92,
          gap: 8,
          recommendation: 'Solid competency: Verified state management, hooks, and responsive component modularity.'
        },
        {
          name: 'REST APIs & Security',
          required: 85,
          candidate: 60,
          improved: 85,
          gap: -25,
          recommendation: 'Improvement needed: Emphasize JWT authentication, rate limiting, and structured OpenAPI endpoint design.'
        },
        {
          name: 'Testing & DevOps CI',
          required: 75,
          candidate: 40,
          improved: 80,
          gap: -35,
          recommendation: 'Action required: Document automated unit test suites (Jest/Mocha), Docker containerization, and GitHub Actions CI.'
        }
      ]
    },
    backend: {
      title: 'Backend & Distributed Systems Engineer',
      description: 'Candidate evaluated against High-Concurrency Microservices and Cloud Infrastructure.',
      skills: [
        {
          name: 'Concurrency & Go/Java',
          required: 90,
          candidate: 60,
          improved: 90,
          gap: -30,
          recommendation: 'Core requirement: Emphasize multithreaded pipelines, goroutines/worker pools, and race-condition safety.'
        },
        {
          name: 'Distributed Data Stores',
          required: 85,
          candidate: 50,
          improved: 85,
          gap: -35,
          recommendation: 'Gap detected: Include Redis caching tiers, replication topologies, and database partitioning patterns.'
        },
        {
          name: 'API Protocols (gRPC/REST)',
          required: 85,
          candidate: 75,
          improved: 88,
          gap: -10,
          recommendation: 'Slight gap: Highlight Protocol Buffers implementation and microservice service-mesh routing.'
        },
        {
          name: 'System Design & Scale',
          required: 85,
          candidate: 55,
          improved: 85,
          gap: -30,
          recommendation: 'High priority: Quantify request-per-second scaling achievements and fault-tolerant architectural designs.'
        },
        {
          name: 'Observability & Metrics',
          required: 75,
          candidate: 70,
          improved: 80,
          gap: -5,
          recommendation: 'Near benchmark: Mention Prometheus metrics, structured tracing, and OpenTelemetry instrumentation.'
        },
        {
          name: 'Containerization & Linux',
          required: 80,
          candidate: 80,
          improved: 85,
          gap: 0,
          recommendation: 'Meets expectation: Good foundation in Docker image optimization and Linux system operations.'
        }
      ]
    },
    devops: {
      title: 'Cloud DevOps & Site Reliability Engineer',
      description: 'Candidate evaluated against Cloud Infrastructure, Orchestration, and Infrastructure-as-Code.',
      skills: [
        {
          name: 'Kubernetes & Pods',
          required: 90,
          candidate: 50,
          improved: 90,
          gap: -40,
          recommendation: 'Critical deficit: Document production Kubernetes deployments, Helm charts, and ingress controllers.'
        },
        {
          name: 'Cloud Services (AWS/GCP)',
          required: 85,
          candidate: 80,
          improved: 88,
          gap: -5,
          recommendation: 'Solid baseline: Highlight multi-region VPC topologies and IAM least-privilege security controls.'
        },
        {
          name: 'Infrastructure as Code',
          required: 85,
          candidate: 55,
          improved: 85,
          gap: -30,
          recommendation: 'Improvement needed: Add Terraform module development and state management in team environments.'
        },
        {
          name: 'CI/CD Pipeline Design',
          required: 85,
          candidate: 70,
          improved: 88,
          gap: -15,
          recommendation: 'Room for growth: Showcase automated rollback strategies, canary deployments, and pipeline security scans.'
        },
        {
          name: 'Monitoring & Incident SRE',
          required: 80,
          candidate: 60,
          improved: 82,
          gap: -20,
          recommendation: 'Focus area: Detail SLI/SLO definition, PagerDuty alerting thresholds, and post-mortem facilitation.'
        },
        {
          name: 'Linux Systems & Scripting',
          required: 80,
          candidate: 85,
          improved: 90,
          gap: 5,
          recommendation: 'Strong: Bash and Python scripting capabilities meet senior engineering expectations.'
        }
      ]
    },
    frontend: {
      title: 'Senior Frontend & UI Systems Engineer',
      description: 'Candidate evaluated against Web Performance, Accessible UI Architecture, and State Management.',
      skills: [
        {
          name: 'TypeScript & Typings',
          required: 90,
          candidate: 85,
          improved: 92,
          gap: -5,
          recommendation: 'Near benchmark: Add generics and strict runtime schema validation (Zod) experience.'
        },
        {
          name: 'Component Architecture',
          required: 90,
          candidate: 90,
          improved: 95,
          gap: 0,
          recommendation: 'Excellent: Proven track record in reusable design systems and headless component patterns.'
        },
        {
          name: 'Core Web Vitals & Perf',
          required: 85,
          candidate: 55,
          improved: 88,
          gap: -30,
          recommendation: 'Key gap: Highlight bundle chunk-splitting, image optimization, and sub-1.5s LCP/CLS audit scores.'
        },
        {
          name: 'State & SSR (Next.js)',
          required: 85,
          candidate: 75,
          improved: 88,
          gap: -10,
          recommendation: 'Slight gap: Feature server actions, streaming hydration, and edge-rendered architectures.'
        },
        {
          name: 'Accessibility (WCAG AA)',
          required: 80,
          candidate: 50,
          improved: 82,
          gap: -30,
          recommendation: 'Improvement needed: Showcase screen-reader testing, keyboard focus trapping, and ARIA patterns.'
        },
        {
          name: 'Automated E2E Testing',
          required: 80,
          candidate: 50,
          improved: 80,
          gap: -30,
          recommendation: 'Action needed: Integrate Playwright or Cypress end-to-end testing coverage in deployment pipelines.'
        }
      ]
    }
  };

  let currentRole = 'fullstack';
  let isSimulatingUpgrade = false;

  function initSkillRadar() {
    const container = document.getElementById('radarChartSvgContainer');
    if (!container) return;

    if (typeof d3 === 'undefined') {
      console.warn('[SkillRadar] D3.js not loaded, loading dynamically...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/d3@7';
      script.onload = () => renderRadarChart();
      document.head.appendChild(script);
      return;
    }

    // Set up controls
    const roleSelect = document.getElementById('radarRoleSelect');
    if (roleSelect) {
      roleSelect.value = currentRole;
      roleSelect.addEventListener('change', function (e) {
        currentRole = e.target.value;
        isSimulatingUpgrade = false;
        updateSimulationButtonState();
        renderRadarChart();
      });
    }

    const simBtn = document.getElementById('radarSimulateBtn');
    if (simBtn) {
      simBtn.addEventListener('click', function () {
        isSimulatingUpgrade = !isSimulatingUpgrade;
        updateSimulationButtonState();
        renderRadarChart();
      });
    }

    renderRadarChart();

    // Re-render on theme toggle or resize
    window.addEventListener('resize', debounce(renderRadarChart, 150));
    const themeToggle = document.getElementById('themeToggleBtn');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => setTimeout(renderRadarChart, 50));
    }
  }

  function updateSimulationButtonState() {
    const simBtn = document.getElementById('radarSimulateBtn');
    if (!simBtn) return;
    if (isSimulatingUpgrade) {
      simBtn.classList.add('active');
      simBtn.innerHTML = '↺ Reset to Current Skills';
      simBtn.style.background = 'var(--success, #10b981)';
      simBtn.style.color = '#ffffff';
    } else {
      simBtn.classList.remove('active');
      simBtn.innerHTML = '✨ Simulate Skill Upgrade';
      simBtn.style.background = '';
      simBtn.style.color = '';
    }
  }

  function renderRadarChart() {
    const container = document.getElementById('radarChartSvgContainer');
    if (!container || typeof d3 === 'undefined') return;

    // Clear previous SVG
    container.innerHTML = '';

    const roleInfo = ROLE_DATA[currentRole] || ROLE_DATA.fullstack;
    const skills = roleInfo.skills;
    const numAxes = skills.length;

    // Dimensions
    const width = 430;
    const height = 370;
    const margin = 55;
    const radius = Math.min(width, height) / 2 - margin;

    // Center coordinates
    const cx = width / 2;
    const cy = height / 2;

    const angleSlice = (Math.PI * 2) / numAxes;

    // Max scale
    const maxValue = 100;
    const rScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, radius]);

    // Create SVG element
    const svg = d3.select(container)
      .append('svg')
      .attr('id', 'skillRadarSvg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto')
      .style('max-width', '480px')
      .style('display', 'block')
      .style('margin', '0 auto');

    const g = svg.append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // Detect dark mode from root/body
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                   document.body.classList.contains('dark-theme');
    
    const gridStrokeColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    const textLabelColor = isDark ? '#cbd5e1' : '#334155';
    const gridLabelColor = isDark ? '#64748b' : '#94a3b8';

    // 1. Draw Concentric Grid Rings (Levels 20%, 40%, 60%, 80%, 100%)
    const levels = [20, 40, 60, 80, 100];
    const gridGroup = g.append('g').attr('class', 'radar-grid');

    levels.forEach(level => {
      const levelRadius = rScale(level);

      // Web polygon points for this level
      const points = [];
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const x = levelRadius * Math.cos(angle);
        const y = levelRadius * Math.sin(angle);
        points.push(`${x},${y}`);
      }

      // Draw polygon ring
      gridGroup.append('polygon')
        .attr('points', points.join(' '))
        .attr('fill', level === 100 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') : 'none')
        .attr('stroke', gridStrokeColor)
        .attr('stroke-width', level === 100 ? 1.5 : 1)
        .attr('stroke-dasharray', level === 100 ? 'none' : '2,2');

      // Add percentage label on the top vertical axis
      gridGroup.append('text')
        .attr('x', 4)
        .attr('y', -levelRadius + 3)
        .attr('fill', gridLabelColor)
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .attr('font-family', 'sans-serif')
        .text(`${level}%`);
    });

    // 2. Draw Radial Axes & Labels
    const axisGroup = g.append('g').attr('class', 'radar-axes');

    skills.forEach((skill, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const x2 = radius * Math.cos(angle);
      const y2 = radius * Math.sin(angle);

      // Axis line
      axisGroup.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', gridStrokeColor)
        .attr('stroke-width', 1.2);

      // Text label position
      const labelOffset = 22;
      const lx = (radius + labelOffset) * Math.cos(angle);
      const ly = (radius + labelOffset) * Math.sin(angle);

      // Text anchor determination
      let textAnchor = 'middle';
      if (Math.abs(Math.cos(angle)) > 0.3) {
        textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
      }

      const hasGap = !isSimulatingUpgrade && (skill.candidate < skill.required);
      const labelColor = hasGap ? (isDark ? '#fbbf24' : '#d97706') : textLabelColor;

      const labelText = axisGroup.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', textAnchor)
        .attr('fill', labelColor)
        .attr('font-size', '10.5px')
        .attr('font-weight', hasGap ? '700' : '600')
        .attr('font-family', 'sans-serif')
        .style('cursor', 'pointer')
        .text(skill.name);

      // Add gap indicator badge near text if gap exists
      if (hasGap) {
        axisGroup.append('text')
          .attr('x', lx)
          .attr('y', ly + 12)
          .attr('text-anchor', textAnchor)
          .attr('fill', '#ef4444')
          .attr('font-size', '9px')
          .attr('font-weight', '700')
          .text(`Gap: ${skill.gap}%`);
      }
    });

    // 3. Polygon Generator
    const radarLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.value))
      .angle((d, i) => i * angleSlice);

    // Prepare polygon data
    const requiredData = skills.map(s => ({ name: s.name, value: s.required, raw: s }));
    const candidateData = skills.map(s => ({
      name: s.name,
      value: isSimulatingUpgrade ? s.improved : s.candidate,
      raw: s
    }));

    // Tooltip reference
    const tooltip = d3.select('#radarTooltip');

    // 4. Draw Mandatory Benchmark Layer (Target Line)
    const requiredColor = isDark ? '#f59e0b' : '#d97706';
    const reqGroup = g.append('g').attr('class', 'radar-benchmark-layer');

    reqGroup.append('path')
      .datum(requiredData)
      .attr('d', radarLine)
      .attr('fill', 'rgba(245, 158, 11, 0.08)')
      .attr('stroke', requiredColor)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,3')
      .style('pointer-events', 'none');

    // Required benchmark nodes
    reqGroup.selectAll('.benchmark-node')
      .data(requiredData)
      .enter()
      .append('rect')
      .attr('class', 'benchmark-node')
      .attr('x', (d, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return rScale(d.value) * Math.cos(angle) - 3.5;
      })
      .attr('y', (d, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return rScale(d.value) * Math.sin(angle) - 3.5;
      })
      .attr('width', 7)
      .attr('height', 7)
      .attr('fill', requiredColor)
      .attr('transform', (d, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        const x = rScale(d.value) * Math.cos(angle);
        const y = rScale(d.value) * Math.sin(angle);
        return `rotate(45, ${x}, ${y})`;
      })
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        showTooltip(event, d.raw, 'required');
      })
      .on('mouseleave', hideTooltip);

    // 5. Draw Candidate Skillset Layer
    const candidateStrokeColor = isSimulatingUpgrade ? '#10b981' : '#2563eb';
    const candidateFillColor = isSimulatingUpgrade
      ? 'rgba(16, 185, 129, 0.28)'
      : 'rgba(37, 99, 235, 0.22)';

    const candGroup = g.append('g').attr('class', 'radar-candidate-layer');

    const candidatePath = candGroup.append('path')
      .datum(candidateData)
      .attr('d', radarLine)
      .attr('fill', candidateFillColor)
      .attr('stroke', candidateStrokeColor)
      .attr('stroke-width', 2.5);

    // Add animated entrance transition
    candidatePath
      .style('opacity', 0)
      .transition()
      .duration(400)
      .style('opacity', 1);

    // Candidate Nodes with Interactive Tooltip
    const candNodes = candGroup.selectAll('.candidate-node')
      .data(candidateData)
      .enter()
      .append('circle')
      .attr('class', 'candidate-node')
      .attr('cx', (d, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return rScale(d.value) * Math.cos(angle);
      })
      .attr('cy', (d, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        return rScale(d.value) * Math.sin(angle);
      })
      .attr('r', 5)
      .attr('fill', candidateStrokeColor)
      .attr('stroke', isDark ? '#0f172a' : '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 8)
          .attr('stroke-width', 2.5);
        showTooltip(event, d.raw, 'candidate');
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 5)
          .attr('stroke-width', 2);
        hideTooltip();
      });

    // 6. Highlight Deficit Vectors (Red/Amber dashed connector where candidate < required)
    if (!isSimulatingUpgrade) {
      skills.forEach((skill, i) => {
        if (skill.candidate < skill.required) {
          const angle = i * angleSlice - Math.PI / 2;
          const xCand = rScale(skill.candidate) * Math.cos(angle);
          const yCand = rScale(skill.candidate) * Math.sin(angle);
          const xReq = rScale(skill.required) * Math.cos(angle);
          const yReq = rScale(skill.required) * Math.sin(angle);

          g.append('line')
            .attr('x1', xCand)
            .attr('y1', yCand)
            .attr('x2', xReq)
            .attr('y2', yReq)
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '2,2')
            .style('pointer-events', 'none');
        }
      });
    }

    // 7. Render dynamic gap recommendations list below chart
    renderGapSummary(skills);
  }

  function showTooltip(event, skill, focusType) {
    const tooltip = document.getElementById('radarTooltip');
    if (!tooltip) return;

    const effectiveScore = isSimulatingUpgrade ? skill.improved : skill.candidate;
    const diff = effectiveScore - skill.required;
    const isPassing = diff >= 0;

    let statusHtml = '';
    if (isSimulatingUpgrade) {
      statusHtml = `<span style="color: #10b981; font-weight: 700;">✓ Post-Optimization Score: ${effectiveScore}% (Meets Benchmark)</span>`;
    } else if (isPassing) {
      statusHtml = `<span style="color: #10b981; font-weight: 700;">✓ Requirement Met (${effectiveScore}% vs ${skill.required}% required)</span>`;
    } else {
      statusHtml = `<span style="color: #ef4444; font-weight: 700;">⚠️ Deficit of ${Math.abs(diff)}% below minimum bar</span>`;
    }

    tooltip.innerHTML = `
      <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary, #0f172a);">
        ${skill.name}
      </div>
      <div style="font-size: 0.82rem; margin-bottom: 6px; display: flex; gap: 8px;">
        <span><strong>Candidate:</strong> ${effectiveScore}%</span>
        <span>|</span>
        <span><strong>Required:</strong> ${skill.required}%</span>
      </div>
      <div style="font-size: 0.8rem; margin-bottom: 6px;">${statusHtml}</div>
      <div style="font-size: 0.78rem; color: var(--text-secondary, #475569); line-height: 1.35; border-top: 1px solid var(--border-color, #e2e8f0); padding-top: 6px;">
        💡 <em>${skill.recommendation}</em>
      </div>
    `;

    tooltip.style.display = 'block';

    const wrapper = document.getElementById('radarChartWrapper');
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      const x = event.clientX - rect.left + 14;
      const y = event.clientY - rect.top - 10;
      
      // Ensure tooltip stays inside container bounds
      const tooltipWidth = 240;
      const adjustedX = (x + tooltipWidth > rect.width) ? (x - tooltipWidth - 28) : x;
      
      tooltip.style.left = `${Math.max(10, adjustedX)}px`;
      tooltip.style.top = `${Math.max(10, y)}px`;
    }
  }

  function hideTooltip() {
    const tooltip = document.getElementById('radarTooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  function renderGapSummary(skills) {
    const container = document.getElementById('radarGapSummary');
    if (!container) return;

    const gaps = skills.filter(s => (isSimulatingUpgrade ? s.improved : s.candidate) < s.required)
                       .sort((a, b) => a.gap - b.gap); // largest gap first

    if (gaps.length === 0) {
      container.innerHTML = `
        <div class="radar-success-callout">
          <div class="callout-icon">🎉</div>
          <div class="callout-content">
            <strong>Candidate Meets All Mandatory Requirements!</strong>
            <p>Demonstrated competency meets or exceeds target threshold across all evaluation axes. Candidate immediately qualifies for the Pre-Interview Verification Gate.</p>
          </div>
        </div>
      `;
      return;
    }

    let itemsHtml = gaps.map(item => `
      <div class="gap-card">
        <div class="gap-card-header">
          <span class="gap-skill-name">${item.name}</span>
          <span class="gap-badge">⚠️ ${Math.abs(item.gap)}% Gap</span>
        </div>
        <div class="gap-metric-row">
          <span class="metric-lbl">Current: <strong>${item.candidate}%</strong></span>
          <span class="metric-div">/</span>
          <span class="metric-lbl">Required: <strong>${item.required}%</strong></span>
        </div>
        <p class="gap-recommendation">${item.recommendation}</p>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="gap-summary-header">
        <h5>Priority Improvement Areas (${gaps.length} Requirement Gaps Identified)</h5>
        <span class="gap-summary-sub">Visualized on radar chart with highlighted deficit lines</span>
      </div>
      <div class="gap-cards-grid">
        ${itemsHtml}
      </div>
    `;
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Self-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkillRadar);
  } else {
    initSkillRadar();
  }

  // Export for external callers if needed
  window.AIRIS_SkillRadar = {
    render: renderRadarChart,
    setRole: function (roleKey) {
      if (ROLE_DATA[roleKey]) {
        currentRole = roleKey;
        const roleSelect = document.getElementById('radarRoleSelect');
        if (roleSelect) roleSelect.value = roleKey;
        renderRadarChart();
      }
    }
  };
})();
