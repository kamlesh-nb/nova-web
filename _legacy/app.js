/* ==========================================================================
   Kyte Lang Promotion JS Logic - Interactive Simulator & Documentation Viewer
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // 1. Data Store for Simulator and Code Tour
    // ----------------------------------------------------------------------

    const SIMULATOR_DATA = {
        http_request: {
            title: "HTTP GET /products",
            status: "Simulating HTTP",
            statusClass: "badge-cyan",
            description: "Trace details: A web request hits the L7 reverse proxy. The runtime fan-out accept loop delegates the connection to reactor 0 (SO_REUSEPORT). Zero-copy parsing reads headers from the stream, and issues an async query to NovaDB. A JSON response is dumped to the output stream.",
            latency: "0.28 ms",
            mem: "12 KB (Heap)",
            threads: "Reactor 0 (Core 0)",
            code: `import web.app;
import web.request;
import web.response;

// MediatR style handler
class GetProductsHandler : MessageHandler<GetProductsRequest, Response> {
    async fn handle(self, req: GetProductsRequest): Response {
        let params = List<DbValue>();
        let rs = await db.query("SELECT * FROM products LIMIT 10", params);
        return Response.json(rs);
    }
}`,
            flow: ["client", "sandbox", "runtime", "storage"]
        },
        db_write: {
            title: "NovaDB Write Transaction",
            status: "Database Commit",
            statusClass: "badge-cyan",
            description: "Trace details: Mutation request parses SQL into execution plan. The transactional engine writes to Write-Ahead Log (WAL) first to guarantee durability. Traverses the B+Tree to leaf node page. Writes cell into slotted page, performing an in-place zero-allocation page compaction if needed. Prior values are stored in the MVCC undo log for readers.",
            latency: "1.45 ms",
            mem: "42 KB (Buffers)",
            threads: "Reactor 1 (Core 1)",
            code: `import data.db;

async fn createProduct(name: string, price: decimal): int {
    let conn = await db.connect("novadb://localhost:5432/store");
    let params = List<DbValue>([
        DbValue.string(name),
        DbValue.decimal(price)
    ]);
    
    // Auto-commit transactional statement
    let result = await conn.exec(
        "INSERT INTO products (name, price) VALUES ($1, $2)", 
        params
    );
    return result.rowsAffected();
}`,
            flow: ["runtime", "storage"]
        },
        autoscale: {
            title: "Autoscale Workload Replica",
            status: "Autoscale Event",
            statusClass: "badge-emerald",
            description: "Trace details: The autoscale daemon reads the in-flight metrics queue from the proxy. The PID controller calculates standard error and decides that replica scaling is needed. Invokes the native process supervisor to fork a sandboxed process. The namespace container limit isolates the process on CPU/memory cgroups.",
            latency: "4.80 ms",
            mem: "1.2 MB (Sandbox)",
            threads: "Control Loop (Async)",
            code: `import net.autoscale;
import os.sandbox;

fn reconcileWorkload(manifest: string): void {
    let spec = parseSpec(manifest);
    let scale = autoscale.PidController(0.8, 0.2, 0.1);
    let desired = scale.decide(spec.currentLoad);
    
    if (desired > spec.replicas) {
        // Native container-free spawn inside namespaces
        sandbox.spawn(spec.binaryPath, spec.args, spec.limits);
    }
}`,
            flow: ["client", "runtime", "sandbox"]
        }
    };

    const TOUR_CODE = {
        web: {
            file: "main.ky",
            title: "Web Accept Visualizer",
            desc: "Register API endpoints and handlers in ASP.NET vertical slice format. App loops run in process over SO_REUSEPORT, mapping connections straight to pinned core processors without intermediate network proxy layers.",
            code: `import web.app;
import Features.Products.GetProducts;

fn main(): int {
    // Hold reactors so server blocks for process lifetime
    app.holdReactors();
    
    let server = app.App();
    server.get<GetProductsRequest>("/products");
    
    // Start accept fan-out across reactors
    server.run(8080);
    return 0;
}`
        },
        db: {
            file: "repository.ky",
            title: "Database Trait Seam",
            desc: "NovaDB acts as an exchangeable storage engine backing standard Connection traits. Dynamic SQL binding leverages raw pointer indices, keeping transaction calls lock-free and isolated per core reactor.",
            code: `import data.db;

class ProductRepository {
    let driver: Driver;

    async fn getProductById(self, id: int): Product {
        let conn = await self.driver.connect("novadb://localhost:5432");
        let params = List<DbValue>([DbValue.int(id)]);
        let rs = await conn.query("SELECT * FROM products WHERE id = $1", params);
        
        if (rs.rows.length == 0) {
            throw ProductNotFoundException();
        }
        return Product.fromRow(rs.rows.at(0));
    }
}`
        },
        actor: {
            file: "worker.ky",
            title: "Actor Model & Mailboxes",
            desc: "Actors process message streams via asynchronous bounded channels. Since each reactor drives coroutine suspension natively, tasks park without holding up core thread contexts.",
            code: `import concurrency.actor;
import concurrency.channel;

class DatabaseWorker : Actor<Command> {
    let inbox: Mailbox<Command>;

    async fn run(self): void {
        while (true) {
            // Suspends coroutine if mailbox is empty
            let cmd = await self.inbox.receive();
            self.executeCommand(cmd);
        }
    }
}`
        },
        sandbox: {
            file: "supervisor.ky",
            title: "cgroups-v2 & Process Sandbox",
            desc: "The orchestrator uses native Linux namespaces to restrict cpu, memory and pids. On macOS, this configuration degrades gracefully to standard supervised execution.",
            code: `import os.sandbox;
import orch.spec;

fn supervisorDaemon(specPath: string): void {
    let workload = parseSpec(specPath);
    let limits = sandbox.IsolationSpec(
        workload.cpuMilli,       // e.g. 500 = 0.5 cores
        workload.memMaxBytes,    // e.g. 256MB limit
        workload.pidsMax
    );
    
    // Direct Linux pivot_root clone & seccomp filter loading
    let pid = sandbox.spawn(workload.binaryPath, workload.args, limits);
    log.info("Spawned sandboxed process with PID " + pid.toString());
}`
        }
    };

    // ----------------------------------------------------------------------
    // 2. Interactive Simulator Logic
    // ----------------------------------------------------------------------
    const simButtons = document.querySelectorAll(".sim-btn");
    const layers = {
        client: document.getElementById("layer-client"),
        sandbox: document.getElementById("layer-sandbox"),
        runtime: document.getElementById("layer-runtime"),
        storage: document.getElementById("layer-storage")
    };
    const nodes = {
        client: document.getElementById("node-client"),
        sandbox: document.getElementById("node-sandbox"),
        storage: document.getElementById("node-storage")
    };
    const reactors = [
        document.getElementById("reactor-0"),
        document.getElementById("reactor-1"),
        document.getElementById("reactor-2")
    ];
    const pulses = {
        1: document.getElementById("pulse-1"),
        2: document.getElementById("pulse-2"),
        3: document.getElementById("pulse-3")
    };

    const detailTitle = document.getElementById("detail-title");
    const detailStatus = document.getElementById("detail-status");
    const detailDesc = document.getElementById("detail-description");
    const detailCode = document.getElementById("detail-code");
    const statLatency = document.getElementById("stat-latency");
    const statMem = document.getElementById("stat-mem");
    const statThreads = document.getElementById("stat-threads");

    let simTimeout = null;

    function resetSimVisuals() {
        if (simTimeout) clearTimeout(simTimeout);
        
        // Remove active layer styles
        Object.values(layers).forEach(layer => layer.classList.remove("active"));
        Object.values(nodes).forEach(node => node.classList.remove("highlight"));
        reactors.forEach(r => r.classList.remove("active"));
        Object.values(pulses).forEach(p => p.classList.remove("pulsing"));
    }

    function runSimulation(actionKey) {
        resetSimVisuals();
        const data = SIMULATOR_DATA[actionKey];
        if (!data) return;

        // Update details panel immediately
        detailTitle.textContent = data.title;
        detailStatus.textContent = data.status;
        detailStatus.className = `badge ${data.statusClass}`;
        detailDesc.textContent = data.description;
        detailCode.textContent = data.code;
        statLatency.textContent = data.latency;
        statMem.textContent = data.mem;
        statThreads.textContent = data.threads;

        const flow = data.flow;
        let step = 0;

        function executeStep() {
            if (step >= flow.length) {
                detailStatus.textContent = "Completed";
                return;
            }

            const current = flow[step];
            
            // Highlight layer
            if (layers[current]) layers[current].classList.add("active");
            
            // Highlight specific node boxes
            if (nodes[current]) nodes[current].classList.add("highlight");

            // Handle Reactor Layer specificity
            if (current === "runtime") {
                // Activate specific reactor based on action
                const targetIdx = actionKey === "http_request" ? 0 : (actionKey === "db_write" ? 1 : 2);
                reactors.forEach((r, idx) => {
                    if (idx === targetIdx) r.classList.add("active");
                    else r.classList.remove("active");
                });
            }

            // Start pulse line to next node if available
            if (step < flow.length - 1) {
                const pulseId = step + 1;
                if (pulses[pulseId]) pulses[pulseId].classList.add("pulsing");
            }

            step++;
            simTimeout = setTimeout(executeStep, 1000);
        }

        executeStep();
    }

    // Bind Sim Buttons
    simButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            simButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const action = btn.getAttribute("data-action");
            runSimulation(action);
        });
    });

    // Run first simulation by default
    runSimulation("http_request");


    // ----------------------------------------------------------------------
    // 3. Performance Sandbox Sliders & Charts
    // ----------------------------------------------------------------------
    const sliderConcurrency = document.getElementById("slider-concurrency");
    const sliderCores = document.getElementById("slider-cores");
    const sliderLimit = document.getElementById("slider-limit");

    const valConcurrency = document.getElementById("val-concurrency");
    const valCores = document.getElementById("val-cores");
    const valLimit = document.getElementById("val-limit");

    // Chart Nodes
    const barLatencyKyte = document.getElementById("bar-latency-kyte");
    const barLatencyGo = document.getElementById("bar-latency-go");
    const barLatencyNode = document.getElementById("bar-latency-node");

    const numLatencyKyte = document.getElementById("num-latency-kyte");
    const numLatencyGo = document.getElementById("num-latency-go");
    const numLatencyNode = document.getElementById("num-latency-node");

    const barMemKyte = document.getElementById("bar-mem-kyte");
    const barMemGo = document.getElementById("bar-mem-go");
    const barMemNode = document.getElementById("bar-mem-node");

    const numMemKyte = document.getElementById("num-mem-kyte");
    const numMemGo = document.getElementById("num-mem-go");
    const numMemNode = document.getElementById("num-mem-node");

    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function calculateMetrics() {
        const conn = parseInt(sliderConcurrency.value);
        const cores = parseInt(sliderCores.value);
        const limit = parseInt(sliderLimit.value);

        valConcurrency.textContent = formatNumber(conn);
        valCores.textContent = `${cores} Core${cores > 1 ? 's' : ''}`;
        valLimit.textContent = `${limit} Replica${limit > 1 ? 's' : ''}`;

        // 1. Latency Calculations
        // Kyte has thread-per-core, scales linearly, stays flat
        const latencyKyte = 0.2 + (conn * 0.000005) / cores;
        // Go has concurrency goroutines, grows slowly due to scheduler lock
        const latencyGo = 0.8 + (conn * 0.00003) + (cores * 0.05);
        // Node is single threaded, bottlenecks under concurrency and high cores
        const latencyNode = 2.5 + (conn * 0.00015) - (cores * 0.01) + (limit * 0.1);

        // Normalize for visual bar widths (max latency represented is 25ms)
        const maxLatencyVisual = 25.0;
        const widthLatKyte = Math.min(100, Math.max(5, (latencyKyte / maxLatencyVisual) * 100));
        const widthLatGo = Math.min(100, Math.max(5, (latencyGo / maxLatencyVisual) * 100));
        const widthLatNode = Math.min(100, Math.max(5, (latencyNode / maxLatencyVisual) * 100));

        barLatencyKyte.style.width = `${widthLatKyte}%`;
        barLatencyGo.style.width = `${widthLatGo}%`;
        barLatencyNode.style.width = `${widthLatNode}%`;

        numLatencyKyte.textContent = `${latencyKyte.toFixed(1)} ms`;
        numLatencyGo.textContent = `${latencyGo.toFixed(1)} ms`;
        numLatencyNode.textContent = `${latencyNode.toFixed(1)} ms`;

        // 2. Memory Calculations
        // Kyte compiled executable overhead is tiny: 6MB base + ~0.001MB per conn
        const memKyte = 6 + (conn * 0.0008) + (limit * 0.5);
        // Go app overhead is medium: 25MB base + ~0.008MB per conn
        const memGo = 24 + (conn * 0.006) + (limit * 2.0);
        // Node running inside docker is heavy: 120MB V8 base + ~0.04MB per conn + docker namespaces (20MB base)
        const memNode = 130 + (conn * 0.035) + (limit * 45.0);

        // Normalize for visual bar widths (max memory represented is 4GB = 4096MB)
        const maxMemVisual = 4096.0;
        const widthMemKyte = Math.min(100, Math.max(3, (memKyte / maxMemVisual) * 100));
        const widthMemGo = Math.min(100, Math.max(3, (memGo / maxMemVisual) * 100));
        const widthMemNode = Math.min(100, Math.max(3, (memNode / maxMemVisual) * 100));

        barMemKyte.style.width = `${widthMemKyte}%`;
        barMemGo.style.width = `${widthMemGo}%`;
        barMemNode.style.width = `${widthMemNode}%`;

        numMemKyte.textContent = memKyte > 1024 ? `${(memKyte / 1024).toFixed(2)} GB` : `${Math.round(memKyte)} MB`;
        numMemGo.textContent = memGo > 1024 ? `${(memGo / 1024).toFixed(2)} GB` : `${Math.round(memGo)} MB`;
        numMemNode.textContent = memNode > 1024 ? `${(memNode / 1024).toFixed(2)} GB` : `${Math.round(memNode)} MB`;
    }

    [sliderConcurrency, sliderCores, sliderLimit].forEach(sl => {
        sl.addEventListener("input", calculateMetrics);
    });

    // Run first calculation
    calculateMetrics();


    // ----------------------------------------------------------------------
    // 4. Code Tour Navigator
    // ----------------------------------------------------------------------
    const tourTabs = document.querySelectorAll(".tour-tab");
    const tourFileName = document.getElementById("tour-file-name");
    const tourCodeContent = document.getElementById("tour-code-content");
    const tourVisualTitle = document.getElementById("tour-visual-title");
    const tourVisualDesc = document.getElementById("tour-visual-desc");
    const canvasItems = document.querySelectorAll(".canvas-item");

    function loadTourTab(tabKey) {
        const data = TOUR_CODE[tabKey];
        if (!data) return;

        tourFileName.textContent = data.file;
        tourCodeContent.textContent = data.code;
        tourVisualTitle.textContent = data.title;
        tourVisualDesc.textContent = data.desc;

        // Manage active visual state in canvas
        canvasItems.forEach(item => {
            if (item.id === `canvas-${tabKey}`) item.classList.add("active");
            else item.classList.remove("active");
        });
    }

    tourTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tourTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const tabKey = tab.getAttribute("data-tab");
            loadTourTab(tabKey);
        });
    });

    // Load first tour item by default
    loadTourTab("web");


    // ----------------------------------------------------------------------
    // 5. Documentation Slide-Over Viewer & Markdown Parser
    // ----------------------------------------------------------------------
    const btnOpenDocs = document.getElementById("btn-open-docs");
    const btnCloseDocs = document.getElementById("btn-close-docs");
    const docsDrawer = document.getElementById("docs-drawer");
    const docsMenuList = document.getElementById("docs-menu-list");
    const docsContentPane = document.getElementById("docs-content-pane");

    // Simple Custom Markdown to HTML Renderer
    function renderMarkdown(md) {
        let html = md;
        
        // Escape HTML entities to prevent execution of markup
        html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Temporary place to store code blocks so they don't get modified by sub-regexes
        const codeBlocks = [];
        html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            codeBlocks.push(`<pre><code class="language-${lang}">${code}</code></pre>`);
            return `__CODE_BLOCK_${index}__`;
        });

        // Store inline code blocks
        const inlineCode = [];
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            const index = inlineCode.length;
            inlineCode.push(`<code>${code}</code>`);
            return `__INLINE_CODE_${index}__`;
        });

        // Parse tables
        html = html.replace(/\n\|([^\n]+)\|\n\|([\s-|:]+)\|\n([\s\S]*?)(?=\n\n|\n[^|]|$)/g, (match, headerLine, formatLine, rowsContent) => {
            const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
            const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
            
            const rows = rowsContent.split('\n').filter(r => r.trim()).map(row => {
                const cells = row.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
                return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
            });
            
            return `\n<table>${headerHtml}<tbody>${rows.join('')}</tbody></table>\n`;
        });

        // Split text into paragraphs and blocks, processing headers, bold, links, lists etc.
        const lines = html.split("\n");
        let result = [];
        let inList = false;

        for (let line of lines) {
            let processed = line;

            // Handle headers
            if (processed.startsWith("# ")) {
                if (inList) { result.push("</ul>"); inList = false; }
                result.push(`<h1>${processed.slice(2).trim()}</h1>`);
                continue;
            }
            if (processed.startsWith("## ")) {
                if (inList) { result.push("</ul>"); inList = false; }
                result.push(`<h2>${processed.slice(3).trim()}</h2>`);
                continue;
            }
            if (processed.startsWith("### ")) {
                if (inList) { result.push("</ul>"); inList = false; }
                result.push(`<h3>${processed.slice(4).trim()}</h3>`);
                continue;
            }

            // Handle Blockquotes
            if (processed.startsWith("&gt; ")) {
                if (inList) { result.push("</ul>"); inList = false; }
                result.push(`<blockquote>${processed.slice(5).trim()}</blockquote>`);
                continue;
            }

            // Handle lists
            if (processed.startsWith("- ") || processed.startsWith("* ")) {
                if (!inList) {
                    result.push("<ul>");
                    inList = true;
                }
                const content = processed.slice(2).trim();
                result.push(`<li>${content}</li>`);
                continue;
            } else if (processed.trim() === "" && inList) {
                result.push("</ul>");
                inList = false;
                continue;
            }

            // Handle empty line separator
            if (processed.trim() === "") {
                continue;
            }

            // Regular paragraph line
            if (inList) { result.push("</ul>"); inList = false; }
            
            // Format Bold
            processed = processed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
            
            // Format Markdown file scheme links: [label](file:///...) -> [label](href)
            processed = processed.replace(/\[([^\]]+)\]\(file:\/\/\/[^)]+\)/g, "$1");
            // Standard markdown links: [label](url)
            processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

            result.push(`<p>${processed}</p>`);
        }

        if (inList) {
            result.push("</ul>");
        }

        html = result.join("\n");

        // Restore inline code blocks
        inlineCode.forEach((block, index) => {
            html = html.replace(`__INLINE_CODE_${index}__`, block);
        });

        // Restore multi-line code blocks
        codeBlocks.forEach((block, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, block);
        });

        return `<div class="rendered-md">${html}</div>`;
    }

    function initDocsMenu() {
        if (!window.KYTE_DOCS) {
            console.error("Documentation data (docs.js) was not loaded.");
            return;
        }

        docsMenuList.innerHTML = "";
        const keys = Object.keys(window.KYTE_DOCS);
        
        keys.forEach((key, idx) => {
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.className = `docs-menu-item ${idx === 0 ? 'active' : ''}`;
            btn.textContent = key;
            btn.addEventListener("click", () => {
                document.querySelectorAll(".docs-menu-item").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                loadDocContent(key);
            });
            li.appendChild(btn);
            docsMenuList.appendChild(li);
        });

        // Load the first doc file by default
        if (keys.length > 0) {
            loadDocContent(keys[0]);
        }
    }

    function loadDocContent(key) {
        const mdContent = window.KYTE_DOCS[key];
        if (mdContent) {
            docsContentPane.innerHTML = renderMarkdown(mdContent);
            docsContentPane.scrollTop = 0;
        } else {
            docsContentPane.innerHTML = `<div class="docs-loading">Error loading file: ${key}</div>`;
        }
    }

    // Toggle Popover Drawer Programmatically for browsers that need JS triggers
    btnOpenDocs.addEventListener("click", () => {
        if (typeof docsDrawer.showPopover === "function") {
            docsDrawer.showPopover();
        } else {
            docsDrawer.style.display = "flex";
            // Wait for display change to apply transition
            setTimeout(() => {
                docsDrawer.classList.add("open-fallback");
            }, 10);
        }
    });

    btnCloseDocs.addEventListener("click", () => {
        if (typeof docsDrawer.hidePopover === "function") {
            docsDrawer.hidePopover();
        } else {
            docsDrawer.classList.remove("open-fallback");
            setTimeout(() => {
                docsDrawer.style.display = "none";
            }, 350);
        }
    });

    // Populate Docs Panel
    initDocsMenu();
});
