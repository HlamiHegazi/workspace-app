// ============================================================
// CLOUDFLARE WORKER — AI Workspace
// Proxy Notion API + Serve full app HTML
// ============================================================

const DB = {
  attivita: 'abb6fc4c34be4721a40aa7772c486886',
  obiettivi: 'd40d84610e224afca3da3e163656203c',
  scadenze:  '81e0b0bddcf24f0b9b2afa6328f9e099',
  corsi:     'a5c5756e6e0c4f76932ab1f6a33340e8',
  planner:   '712a36b82d484967a6038419c7cce9ef',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === '/api/notion' && request.method === 'POST') {
      return handleNotion(request, env);
    }

    if (url.pathname === '/api/data' && request.method === 'GET') {
      return handleDataLoad(env);
    }

    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleNotion(request, env) {
  try {
    const { endpoint, method = 'GET', data } = await request.json();
    const res = await fetch(`https://api.notion.com/v1/${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && data ? JSON.stringify(data) : undefined,
    });
    const json = await res.json();
    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    });
  }
}

async function handleDataLoad(env) {
  const call = async (endpoint, data) => {
    try {
      const res = await fetch(`https://api.notion.com/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data || { page_size: 50 }),
      });
      return await res.json();
    } catch { return { results: [] }; }
  };

  const [att, obi, sca, cor] = await Promise.all([
    call(`databases/${DB.attivita}/query`, { page_size: 50, sorts: [{ property: 'Scadenza', direction: 'ascending' }] }),
    call(`databases/${DB.obiettivi}/query`, { page_size: 20 }),
    call(`databases/${DB.scadenze}/query`, { page_size: 20, sorts: [{ property: 'Data', direction: 'ascending' }] }),
    call(`databases/${DB.corsi}/query`, { page_size: 20 }),
  ]);

  return new Response(JSON.stringify({
    attivita: att.results || [],
    obiettivi: obi.results || [],
    scadenze: sca.results || [],
    corsi: cor.results || [],
  }), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}

// ============================================================
// FULL APP HTML
// ============================================================
const HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Workspace</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --tan:#c5a882;--brown:#a07850;--dark:#7a5c42;--green:#7a9e6b;
  --red:#c97070;--orange:#c99070;
  --bg:#faf8f5;--card:#fff;--border:rgba(197,168,130,0.25);
  --text:#3a2e24;--muted:#9a8878;--light:#f2ede6;
}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:72px;font-size:14px}
.screen{display:none;padding:16px 16px 8px;max-width:900px;margin:0 auto}
.screen.active{display:block}

/* CARDS */
.card{background:var(--card);border:0.5px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px}
.card-title{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}

/* BADGES */
.badge{display:inline-flex;align-items:center;font-size:11px;font-weight:500;border-radius:20px;padding:2px 8px;white-space:nowrap}
.badge-urgente{background:#fde8e8;color:#c05050}
.badge-alta{background:#fdeee0;color:#a06030}
.badge-media{background:#f5f0e8;color:#806040}
.badge-bassa{background:#f0f0f0;color:#808080}
.badge-corso{background:#e8f0fe;color:#3060a0}
.badge-green{background:#e8f4e8;color:#4a7a4a}
.badge-tan{background:#f5ede0;color:var(--dark)}

/* BOTTOM NAV */
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:var(--card);border-top:0.5px solid var(--border);display:flex;z-index:100;padding:8px 0 env(safe-area-inset-bottom,8px)}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:4px;color:var(--muted);font-size:10px;font-family:inherit;transition:.2s}
.nav-btn.active{color:var(--tan)}
.nav-btn svg{width:20px;height:20px}

/* TOP WIDGETS */
.widgets-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px}
@media(max-width:600px){.widgets-row{grid-template-columns:1fr}}

/* POMODORO */
.pomo-ring{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.pomo-svg{position:relative;width:80px;height:80px}
.pomo-svg circle{fill:none;stroke-width:5;cx:40;cy:40;r:34;stroke-linecap:round}
.pomo-bg{stroke:var(--light)}
.pomo-arc{stroke:var(--green);transition:stroke-dashoffset .5s,stroke .5s;transform-origin:center;transform:rotate(-90deg)}
.pomo-time{font-size:13px;font-weight:600;color:var(--text)}
.pomo-tomatoes{font-size:11px;color:var(--muted)}
.pomo-btns{display:flex;gap:6px;justify-content:center}
.btn-sm{font-size:11px;font-family:inherit;border:1px solid var(--border);background:var(--bg);border-radius:8px;padding:4px 10px;cursor:pointer;color:var(--text);font-weight:500;transition:.15s}
.btn-sm:hover{background:var(--light)}
.btn-primary{background:var(--tan);color:#fff;border-color:var(--tan)}
.btn-primary:hover{background:var(--brown)}

/* QUICK NOTES */
.note-input-row{display:flex;gap:6px;margin-bottom:8px}
.note-input{flex:1;border:0.5px solid var(--border);border-radius:8px;padding:6px 10px;font-family:inherit;font-size:13px;background:var(--bg);outline:none}
.note-input:focus{border-color:var(--tan)}
.note-item{display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-bottom:0.5px solid var(--border);font-size:12px}
.note-item:last-child{border:none}
.note-time{color:var(--muted);font-size:10px;flex-shrink:0;margin-top:1px}
.note-del{background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;line-height:1;padding:0 2px;margin-left:auto;flex-shrink:0}

/* DA RECUPERARE */
.recover-item{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border);font-size:12px}
.recover-item:last-child{border:none}
.recover-btns{display:flex;gap:4px;margin-left:auto;flex-shrink:0}

/* TASK LIST */
.task-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)}
.task-item:last-child{border:none}
.task-check{width:18px;height:18px;border:1.5px solid var(--border);border-radius:5px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:.15s}
.task-check.done{background:var(--green);border-color:var(--green)}
.task-check.done::after{content:'✓';color:#fff;font-size:11px}
.task-name{flex:1;font-size:13px}
.task-name.done{text-decoration:line-through;color:var(--muted)}
.task-meta{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.progress-ring-sm{flex-shrink:0}

/* PLANNER */
.planner-wrap{overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--tan) transparent}
.planner-wrap::-webkit-scrollbar{height:2px}
.planner-wrap::-webkit-scrollbar-thumb{background:var(--tan);border-radius:2px}
.planner-grid{display:grid;grid-template-columns:60px repeat(7,1fr);min-width:600px;gap:1px;background:var(--border)}
.planner-cell{background:var(--bg);padding:4px;min-height:52px}
.planner-head{background:var(--card);padding:6px 4px;text-align:center;font-size:11px;font-weight:600;color:var(--muted)}
.planner-head.oggi{background:var(--light);color:var(--dark)}
.planner-label{background:var(--card);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);font-weight:500}
.planner-cell.oggi{background:rgba(197,168,130,.08)}
.planner-cell textarea{width:100%;border:none;background:transparent;resize:none;font-family:inherit;font-size:11px;color:var(--text);outline:none;min-height:40px;line-height:1.4}
.planner-save-btn{margin-top:8px;font-size:11px;font-family:inherit;border:0.5px solid var(--border);background:var(--bg);border-radius:8px;padding:4px 12px;cursor:pointer;color:var(--text)}
.planner-save-btn:hover{background:var(--light)}

/* KANBAN */
.kanban{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media(max-width:500px){.kanban{grid-template-columns:1fr}}
.kanban-col{background:var(--light);border-radius:10px;padding:10px;min-height:100px}
.kanban-col-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:12px;font-weight:600}
.kanban-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.kanban-count{margin-left:auto;font-size:10px;color:var(--muted);font-weight:400}
.kanban-card{background:var(--card);border:0.5px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:grab;transition:.15s}
.kanban-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.kanban-card.dragging{opacity:.5;cursor:grabbing}
.kanban-card-name{font-size:12px;font-weight:500;margin-bottom:4px}
.kanban-card-meta{display:flex;gap:4px;flex-wrap:wrap}
.kanban-empty{font-size:11px;color:var(--muted);text-align:center;padding:8px}
.drop-target{background:rgba(197,168,130,.15);border:1.5px dashed var(--tan)}

/* PROGRESS RINGS */
.rings-row{display:flex;justify-content:space-around;padding:8px 0}
.ring-item{display:flex;flex-direction:column;align-items:center;gap:6px}
.ring-label{font-size:11px;color:var(--muted)}
.ring-svg{width:70px;height:70px}
.ring-svg circle{fill:none;stroke-width:5;stroke-linecap:round}
.ring-bg-c{stroke:var(--light)}
.ring-fg-c{transform-origin:35px 35px;transform:rotate(-90deg);transition:stroke-dashoffset .8s}
.ring-text{font-size:13px;font-weight:600;fill:var(--text)}

/* GOALS */
.goal-item{padding:6px 0;border-bottom:0.5px solid var(--border)}
.goal-item:last-child{border:none}
.goal-name{font-size:12px;margin-bottom:4px}
.goal-bar-wrap{height:5px;background:var(--light);border-radius:3px;overflow:hidden}
.goal-bar{height:100%;border-radius:3px;transition:.5s}

/* CORSI */
.corsi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.corso-card{background:var(--card);border:0.5px solid var(--border);border-radius:12px;padding:14px;border-left:3px solid var(--tan);cursor:pointer;transition:.15s}
.corso-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.06)}
.corso-card-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.corso-emoji{font-size:20px}
.corso-name{font-size:13px;font-weight:600;flex:1}
.corso-prog-bar{height:4px;background:var(--light);border-radius:2px;overflow:hidden;margin-top:6px}
.corso-prog-fill{height:100%;border-radius:2px;transition:.5s}
.corso-meta{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--muted)}
.corso-countdown{font-weight:600}
.corso-countdown.green{color:var(--green)}
.corso-countdown.orange{color:var(--orange)}
.corso-countdown.red{color:var(--red)}
.add-corso-card{border:1.5px dashed var(--border);background:transparent;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--muted);cursor:pointer;min-height:80px}
.add-corso-card:hover{background:var(--light)}

/* SCADENZE */
.scad-item{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--border);font-size:12px}
.scad-item:last-child{border:none}
.scad-item.urgente{background:rgba(201,112,112,.06);border-radius:6px;padding:7px 8px;margin-bottom:2px}
.scad-star{background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted);padding:0}
.scad-star.active{color:var(--tan)}
.scad-date{margin-left:auto;font-size:11px;color:var(--muted);flex-shrink:0}

/* SECTION HEADER */
.sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sec-title{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.sec-btn{font-size:11px;color:var(--tan);background:none;border:none;cursor:pointer;font-family:inherit;font-weight:500}

/* ROADMAP */
.roadmap-cover{background:linear-gradient(135deg,#6b5b95,#8b6baa);border-radius:12px;padding:20px;margin-bottom:12px;color:#fff}
.roadmap-cover h2{font-family:'DM Serif Display',serif;font-size:22px;margin-bottom:4px}
.skill-area{margin-bottom:12px}
.skill-area-title{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
.skill-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:4px 10px;border-radius:20px;margin:3px;cursor:pointer;border:0.5px solid var(--border);background:var(--bg);color:var(--text);transition:.15s}
.skill-tag.studiare{background:#f0f0f0;color:#888}
.skill-tag.studio{background:#fdeee0;color:var(--orange)}
.skill-tag.acquisita{background:#e8f4e8;color:var(--green)}

/* HABIT TRACKER */
.habit-grid{display:grid;grid-template-columns:120px repeat(7,1fr);gap:1px;background:var(--border);border-radius:8px;overflow:hidden}
.habit-head{background:var(--card);padding:6px 4px;text-align:center;font-size:10px;font-weight:600;color:var(--muted)}
.habit-name{background:var(--card);padding:6px 8px;font-size:12px;display:flex;align-items:center}
.habit-cell{background:var(--card);display:flex;align-items:center;justify-content:center;padding:6px}
.habit-circle{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--border);cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;font-size:10px}
.habit-circle.done{background:var(--green);border-color:var(--green);color:#fff}

/* RETRO */
.retro-section{margin-bottom:12px}
.retro-label{font-size:12px;font-weight:600;margin-bottom:6px;color:var(--dark)}
.retro-ta{width:100%;border:0.5px solid var(--border);border-radius:8px;padding:10px;font-family:inherit;font-size:13px;resize:vertical;min-height:80px;background:var(--bg);outline:none}
.retro-ta:focus{border-color:var(--tan)}
.voto-slider{width:100%;accent-color:var(--tan);margin:6px 0}
.voto-display{font-size:24px;font-weight:700;color:var(--tan);text-align:center}

/* TOAST */
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--text);color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;opacity:0;transition:.3s;pointer-events:none;z-index:200;white-space:nowrap}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* BRIEFING */
.briefing-overlay{position:fixed;inset:0;background:rgba(58,46,36,.4);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}
.briefing-modal{background:var(--card);border-radius:16px;padding:20px;max-width:380px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.12)}
.briefing-date{font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em}
.briefing-title{font-family:'DM Serif Display',serif;font-size:20px;margin-bottom:14px;color:var(--dark)}
.briefing-section{margin-bottom:10px}
.briefing-section h4{font-size:11px;font-weight:600;text-transform:uppercase;color:var(--muted);letter-spacing:.06em;margin-bottom:5px}
.briefing-item{font-size:12px;padding:3px 0;border-bottom:0.5px solid var(--border)}
.briefing-item:last-child{border:none}
.briefing-quote{font-style:italic;font-size:13px;color:var(--brown);text-align:center;padding:10px 0;border-top:0.5px solid var(--border);margin-top:10px}
.briefing-close{width:100%;margin-top:14px;padding:10px;background:var(--tan);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer}

/* CONFETTI */
.confetti-piece{position:fixed;width:8px;height:8px;pointer-events:none;z-index:400;animation:confetti-fall 1.5s ease-in forwards}
@keyframes confetti-fall{to{transform:translateY(100vh) rotate(720deg);opacity:0}}

/* ALERT BANNER */
.alert-banner{background:#fde8e8;border:1px solid rgba(201,112,112,.3);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#a04040;display:flex;align-items:center;gap:6px}

/* AGGIORNA BTN */
.aggiorna-btn{font-size:11px;font-family:inherit;border:0.5px solid var(--border);background:var(--bg);border-radius:20px;padding:4px 12px;cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:4px}
.aggiorna-btn:hover{background:var(--light)}
.spinning{animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<!-- ======== BRIEFING POPUP ======== -->
<div id="briefing" class="briefing-overlay" style="display:none">
  <div class="briefing-modal">
    <div class="briefing-date" id="briefingDate"></div>
    <div class="briefing-title">Buongiorno! 👋</div>
    <div class="briefing-section">
      <h4>📌 Task urgenti oggi</h4>
      <div id="briefingUrgenti"><div class="briefing-item" style="color:var(--muted)">Nessuna</div></div>
    </div>
    <div class="briefing-section">
      <h4>⏰ Scadenze entro 3 giorni</h4>
      <div id="briefingScadenze"><div class="briefing-item" style="color:var(--muted)">Nessuna</div></div>
    </div>
    <div class="briefing-quote" id="briefingQuote"></div>
    <button class="briefing-close" onclick="closeBriefing()">Inizia la giornata 🚀</button>
  </div>
</div>

<!-- ======== TOAST ======== -->
<div class="toast" id="toast"></div>

<!-- ======== SCREEN: DASHBOARD ======== -->
<div class="screen active" id="screen-dashboard">

  <!-- TOP WIDGETS -->
  <div class="widgets-row">
    <!-- POMODORO -->
    <div class="card">
      <div class="card-title">⏱ Pomodoro</div>
      <div class="pomo-ring">
        <svg class="pomo-svg" viewBox="0 0 80 80">
          <circle class="pomo-bg" cx="40" cy="40" r="34"/>
          <circle class="pomo-arc" id="pomoArc" cx="40" cy="40" r="34"
            stroke-dasharray="213.6" stroke-dashoffset="0"/>
        </svg>
        <div class="pomo-time" id="pomoTime">50:00</div>
        <div class="pomo-tomatoes" id="pomoTomatoes">🍅 ×0</div>
      </div>
      <div class="pomo-btns" style="margin-top:8px">
        <button class="btn-sm btn-primary" id="pomoBtnStart" onclick="pomoToggle()">▶</button>
        <button class="btn-sm" onclick="pomoReset()">↺</button>
      </div>
    </div>

    <!-- NOTE VELOCI -->
    <div class="card">
      <div class="card-title">📝 Note veloci</div>
      <div class="note-input-row">
        <input class="note-input" id="noteInput" placeholder="Scrivi..." onkeydown="if(event.key==='Enter')addNote()">
        <button class="btn-sm btn-primary" onclick="addNote()">→</button>
      </div>
      <div id="noteList"></div>
    </div>

    <!-- DA RECUPERARE -->
    <div class="card">
      <div class="card-title">🔄 Da recuperare</div>
      <div id="recoverList"><div style="font-size:12px;color:var(--muted)">Caricamento...</div></div>
    </div>
  </div>

  <!-- ATTIVITÀ OGGI -->
  <div class="card">
    <div class="sec-header">
      <div class="sec-title">📋 Attività di oggi</div>
      <button class="aggiorna-btn" onclick="loadData(true)">
        <span id="aggiornaSpin">↻</span> Aggiorna
      </button>
    </div>
    <div id="oggiAlert"></div>
    <div id="oggiList"><div style="font-size:12px;color:var(--muted)">Caricamento...</div></div>
    <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:11px;color:var(--muted)" id="oggiStats"></div>
      <div id="oggiRing"></div>
    </div>
  </div>

  <!-- PLANNER + SCADENZE -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="card" style="grid-column:1">
      <div class="card-title">📅 Planner settimanale</div>
      <div class="planner-wrap">
        <div class="planner-grid" id="plannerGrid"></div>
      </div>
      <button class="planner-save-btn" onclick="savePlanner()">💾 Salva planner</button>
    </div>
    <div class="card" style="grid-column:2">
      <div class="card-title">⏰ Scadenze</div>
      <div id="scadenzeList"><div style="font-size:12px;color:var(--muted)">Caricamento...</div></div>
    </div>
  </div>

  <!-- KANBAN -->
  <div class="card">
    <div class="card-title">🗂 Kanban attività</div>
    <div class="kanban" id="kanban"></div>
  </div>

  <!-- OBIETTIVI + PROGRESSI -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="card">
      <div class="card-title">🎯 Obiettivi del mese</div>
      <div id="obiettiviList"><div style="font-size:12px;color:var(--muted)">Caricamento...</div></div>
    </div>
    <div class="card">
      <div class="card-title">📊 Progressi del mese</div>
      <div class="rings-row" id="progressiRings"></div>
    </div>
  </div>

  <!-- CORSI -->
  <div class="card">
    <div class="sec-header">
      <div class="sec-title">📚 Corsi ITS</div>
      <button class="sec-btn" onclick="showScreen('corsi')">→ Tutti</button>
    </div>
    <div class="corsi-grid" id="corsiList"></div>
  </div>

</div>

<!-- ======== SCREEN: CORSI ======== -->
<div class="screen" id="screen-corsi">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <button class="btn-sm" onclick="showScreen('dashboard')">← Dashboard</button>
    <div style="font-size:16px;font-weight:600">📚 Corsi ITS</div>
  </div>
  <div class="corsi-grid" id="corsiListFull"></div>
</div>

<!-- ======== SCREEN: ROADMAP ======== -->
<div class="screen" id="screen-roadmap">
  <button class="btn-sm" style="margin-bottom:12px" onclick="showScreen('dashboard')">← Dashboard</button>
  <div class="roadmap-cover">
    <h2>🤖 AI Engineer Roadmap</h2>
    <p style="font-size:13px;opacity:.85">Il tuo percorso verso l'AI Engineering</p>
  </div>
  <div class="card">
    <div class="card-title">Skill Map</div>
    <div id="skillMap"></div>
  </div>
</div>

<!-- ======== SCREEN: HABIT ======== -->
<div class="screen" id="screen-habit">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <button class="btn-sm" onclick="showScreen('dashboard')">← Dashboard</button>
    <div style="font-size:16px;font-weight:600">🌿 Habit Tracker</div>
  </div>
  <div class="card">
    <div class="habit-grid" id="habitGrid"></div>
  </div>
</div>

<!-- ======== SCREEN: RETRO ======== -->
<div class="screen" id="screen-retro">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <button class="btn-sm" onclick="showScreen('dashboard')">← Dashboard</button>
    <div style="font-size:16px;font-weight:600">🔁 Retrospettiva</div>
  </div>
  <div class="card">
    <div class="retro-section">
      <div class="retro-label">🎯 Obiettivi della settimana</div>
      <textarea class="retro-ta" id="retroObiettivi" placeholder="Cosa volevi raggiungere?"></textarea>
    </div>
    <div class="retro-section">
      <div class="retro-label">✅ Cosa hai completato</div>
      <textarea class="retro-ta" id="retroCompletato" placeholder="Cosa hai fatto di buono?"></textarea>
    </div>
    <div class="retro-section">
      <div class="retro-label">📈 Cosa migliorare</div>
      <textarea class="retro-ta" id="retroMigliorare" placeholder="Cosa puoi fare meglio?"></textarea>
    </div>
    <div class="retro-section">
      <div class="retro-label">⭐ Voto della settimana</div>
      <div class="voto-display" id="votoDisplay">7</div>
      <input type="range" class="voto-slider" min="1" max="10" value="7" id="votoSlider"
        oninput="document.getElementById('votoDisplay').textContent=this.value">
    </div>
    <button class="btn-sm btn-primary" style="width:100%;padding:10px" onclick="saveRetro()">💾 Salva retrospettiva</button>
  </div>
</div>

<!-- ======== BOTTOM NAV ======== -->
<nav class="bottom-nav">
  <button class="nav-btn active" id="nav-dashboard" onclick="showScreen('dashboard')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    Dashboard
  </button>
  <button class="nav-btn" id="nav-corsi" onclick="showScreen('corsi')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V7l8-4 8 4v12"/><path d="M9 19v-5h6v5"/><path d="M12 3v8"/></svg>
    Corsi
  </button>
  <button class="nav-btn" id="nav-roadmap" onclick="showScreen('roadmap')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-3.3-6.7-2.1 2.1M8.4 15.6l-2.1 2.1M17.7 17.7l-2.1-2.1M8.4 8.4 6.3 6.3"/></svg>
    Roadmap
  </button>
  <button class="nav-btn" id="nav-habit" onclick="showScreen('habit')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="m9 12 2 2 4-4"/></svg>
    Habit
  </button>
  <button class="nav-btn" id="nav-retro" onclick="showScreen('retro')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
    Retro
  </button>
</nav>

<script>
// ============================================================
// STATE
// ============================================================
let STATE = {
  attivita: [],
  obiettivi: [],
  scadenze: [],
  corsi: [],
  loaded: false,
};

const TODAY = new Date();
TODAY.setHours(0,0,0,0);
const YESTERDAY = new Date(TODAY); YESTERDAY.setDate(TODAY.getDate()-1);

// ============================================================
// NOTION API
// ============================================================
async function notionAPI(endpoint, method='GET', data=null) {
  try {
    const res = await fetch('/api/notion', {
      method: 'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({endpoint, method, data})
    });
    return await res.json();
  } catch(e) { return {error: e.message}; }
}

// ============================================================
// LOAD DATA
// ============================================================
async function loadData(forceRefresh=false) {
  const spin = document.getElementById('aggiornaSpin');
  spin.classList.add('spinning');
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    
    STATE.attivita = (data.attivita||[]).map(parseTask);
    STATE.obiettivi = (data.obiettivi||[]).map(parseObiettivo);
    STATE.scadenze = (data.scadenze||[]).map(parseScadenza);
    STATE.corsi = (data.corsi||[]).map(parseCorso);
    STATE.loaded = true;
    
    renderAll();
  } catch(e) {
    showToast('Errore caricamento dati');
    if (!STATE.loaded) renderDemoData();
  } finally {
    spin.classList.remove('spinning');
  }
}

function parseTask(p) {
  const props = p.properties || {};
  return {
    id: p.id,
    nome: props.Nome?.title?.[0]?.plain_text || 'Task senza nome',
    stato: props.Stato?.select?.name || 'Da fare',
    priorita: props.Priorità?.select?.name || '',
    corso: props.Corso?.select?.name || '',
    scadenza: props.Scadenza?.date?.start || null,
    oreStimate: props['Ore stimate']?.number || null,
    oreReali: props['Ore reali']?.number || null,
    note: props.Note?.rich_text?.[0]?.plain_text || '',
  };
}

function parseObiettivo(p) {
  const props = p.properties || {};
  return {
    id: p.id,
    nome: props.Obiettivo?.title?.[0]?.plain_text || 'Obiettivo',
    periodo: props.Periodo?.select?.name || '',
    stato: props.Stato?.select?.name || 'Da iniziare',
    progresso: props.Progresso?.number || 0,
    categoria: props.Categoria?.select?.name || '',
  };
}

function parseScadenza(p) {
  const props = p.properties || {};
  return {
    id: p.id,
    titolo: props.Titolo?.title?.[0]?.plain_text || 'Scadenza',
    data: props.Data?.date?.start || null,
    priorita: props.Priorità?.select?.name || '',
    categoria: props.Categoria?.select?.name || '',
    completata: props.Completata?.select?.name === 'Sì',
  };
}

function parseCorso(p) {
  const props = p.properties || {};
  return {
    id: p.id,
    nome: props['Nome Corso']?.title?.[0]?.plain_text || 'Corso',
    docente: props.Docente?.rich_text?.[0]?.plain_text || '',
    stato: props.Stato?.select?.name || 'Attivo',
    progressione: props.Progressione?.number || 0,
    crediti: props.Crediti?.number || 0,
    dataEsame: props['Data Esame']?.date?.start || null,
    colore: props.Colore?.select?.name || 'tan',
  };
}

// ============================================================
// DEMO DATA (fallback)
// ============================================================
function renderDemoData() {
  STATE.attivita = [
    {id:'demo1',nome:'Completare notebook NumPy',stato:'Completata',priorita:'Alta',corso:'🐍 Python per Data Science',scadenza:formatDate(TODAY),oreStimate:2,oreReali:1.5},
    {id:'demo2',nome:'Rivedere slide Big Data cap. 1-3',stato:'Da fare',priorita:'Urgente',corso:'📊 Big Data & Analytics',scadenza:formatDate(TODAY),oreStimate:1.5,oreReali:null},
    {id:'demo3',nome:'Studiare LLM intro su Coursera',stato:'Da fare',priorita:'Media',corso:'💻 Machine Learning',scadenza:formatDate(TODAY),oreStimate:2,oreReali:null},
  ];
  STATE.corsi = [
    {id:'c1',nome:'Big Data & Analytics',docente:'Prof. Rossi',stato:'Attivo',progressione:60,crediti:6,dataEsame:'2026-05-15',colore:'blue'},
    {id:'c2',nome:'Python per Data Science',docente:'Prof. Bianchi',stato:'Attivo',progressione:45,crediti:4,dataEsame:'2026-04-20',colore:'green'},
    {id:'c3',nome:'Machine Learning',docente:'Prof. Verdi',stato:'Attivo',progressione:30,crediti:6,dataEsame:'2026-06-10',colore:'purple'},
  ];
  STATE.loaded = true;
  renderAll();
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderOggi();
  renderRecupera();
  renderKanban();
  renderScadenze();
  renderObiettivi();
  renderProgressi();
  renderCorsi();
  renderPlanner();
}

// ============================================================
// ATTIVITÀ OGGI
// ============================================================
function renderOggi() {
  const todayStr = formatDate(TODAY);
  const tasks = STATE.attivita.filter(t =>
    t.scadenza === todayStr || (t.priorita === 'Urgente' && !t.scadenza)
  );
  
  const alertEl = document.getElementById('oggiAlert');
  const urgenti = STATE.scadenze.filter(s => {
    if (!s.data || s.completata) return false;
    const d = new Date(s.data); d.setHours(0,0,0,0);
    return (d - TODAY) / 86400000 <= 3;
  });
  alertEl.innerHTML = urgenti.length ? \`<div class="alert-banner">⚠️ \${urgenti.length} scadenz\${urgenti.length>1?'e':'a'} entro 3 giorni!</div>\` : '';

  const done = tasks.filter(t => t.stato === 'Completata').length;
  const pct = tasks.length ? Math.round(done/tasks.length*100) : 0;
  
  document.getElementById('oggiStats').textContent = tasks.length ? \`\${done}/\${tasks.length} completate\` : '';
  document.getElementById('oggiRing').innerHTML = tasks.length ? ringHTML(pct,44,'var(--green)') : '';

  const el = document.getElementById('oggiList');
  if (!tasks.length) { el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:4px 0">Nessuna task per oggi 🎉</div>'; return; }
  
  el.innerHTML = tasks.map(t => \`
    <div class="task-item" id="task-\${t.id}">
      <div class="task-check \${t.stato==='Completata'?'done':''}" onclick="toggleTask('\${t.id}')"></div>
      <div class="task-name \${t.stato==='Completata'?'done':''}">\${t.nome}</div>
      <div class="task-meta">
        \${t.priorita ? \`<span class="badge badge-\${t.priorita.toLowerCase()}">\${t.priorita}</span>\`:''}
        \${t.corso ? \`<span class="badge badge-corso" style="font-size:10px">\${corsoShort(t.corso)}</span>\`:''}
        \${t.oreStimate ? \`<span class="badge badge-tan">\${t.oreStimate}h</span>\`:''}
      </div>
    </div>
  \`).join('');
}

function corsoShort(corso) {
  return corso.split(' ').slice(0,2).join(' ');
}

async function toggleTask(id) {
  const task = STATE.attivita.find(t => t.id === id);
  if (!task) return;
  const newStato = task.stato === 'Completata' ? 'Da fare' : 'Completata';
  task.stato = newStato;
  renderOggi();
  renderKanban();
  renderProgressi();
  if (newStato === 'Completata') confetti();
  await notionAPI(\`pages/\${id}\`, 'PATCH', {
    properties: { Stato: { select: { name: newStato } } }
  });
}

// ============================================================
// DA RECUPERARE
// ============================================================
function renderRecupera() {
  const yStr = formatDate(YESTERDAY);
  const tasks = STATE.attivita.filter(t => t.scadenza === yStr && t.stato !== 'Completata');
  const el = document.getElementById('recoverList');
  if (!tasks.length) { el.innerHTML='<div style="font-size:12px;color:var(--muted)">Tutto in pari! ✓</div>'; return; }
  el.innerHTML = tasks.map(t => \`
    <div class="recover-item">
      <span style="font-size:12px;flex:1">\${t.nome}</span>
      <div class="recover-btns">
        <button class="btn-sm" onclick="moveTask('\${t.id}','oggi')">→ Oggi</button>
        <button class="btn-sm" onclick="moveTask('\${t.id}','dom')">→ Dom</button>
      </div>
    </div>
  \`).join('');
}

async function moveTask(id, when) {
  const task = STATE.attivita.find(t => t.id === id);
  if (!task) return;
  const d = when === 'oggi' ? new Date(TODAY) : new Date(TODAY);
  if (when === 'dom') d.setDate(d.getDate()+1);
  task.scadenza = formatDate(d);
  renderRecupera();
  renderOggi();
  showToast(\`Task spostata a \${when === 'oggi' ? 'oggi' : 'domani'}\`);
  await notionAPI(\`pages/\${id}\`, 'PATCH', {
    properties: { Scadenza: { date: { start: task.scadenza } } }
  });
}

// ============================================================
// KANBAN
// ============================================================
let dragId = null;

function renderKanban() {
  const cols = {
    'Da fare': STATE.attivita.filter(t => t.stato === 'Da fare'),
    'In corso': STATE.attivita.filter(t => t.stato === 'In corso'),
    'Completate': STATE.attivita.filter(t => t.stato === 'Completata'),
  };
  const colors = {'Da fare':'var(--tan)','In corso':'var(--orange)','Completate':'var(--green)'};
  const icons = {'Da fare':'⚪','In corso':'🟡','Completate':'🟢'};

  document.getElementById('kanban').innerHTML = Object.entries(cols).map(([col, tasks]) => \`
    <div class="kanban-col" id="col-\${col.replace(/ /g,'-')}"
      ondragover="event.preventDefault();this.classList.add('drop-target')"
      ondragleave="this.classList.remove('drop-target')"
      ondrop="dropTask(event,'\${col}')">
      <div class="kanban-col-head">
        <span class="kanban-dot" style="background:\${colors[col]}"></span>
        \${col}
        <span class="kanban-count">\${tasks.length}</span>
      </div>
      \${tasks.length ? tasks.map(t => \`
        <div class="kanban-card" draggable="true" id="kcard-\${t.id}"
          ondragstart="dragId='\${t.id}';this.classList.add('dragging')"
          ondragend="this.classList.remove('dragging')">
          <div class="kanban-card-name">\${t.nome}</div>
          <div class="kanban-card-meta">
            \${t.priorita ? \`<span class="badge badge-\${t.priorita.toLowerCase()}">\${t.priorita}</span>\`:''}
            \${t.corso ? \`<span class="badge badge-corso" style="font-size:10px">\${corsoShort(t.corso)}</span>\`:''}
          </div>
        </div>
      \`).join('') : \`<div class="kanban-empty">Nessuna</div>\`}
    </div>
  \`).join('');
}

async function dropTask(e, newStato) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drop-target');
  if (!dragId) return;
  const task = STATE.attivita.find(t => t.id === dragId);
  if (!task || task.stato === newStato) return;
  task.stato = newStato;
  renderKanban();
  renderOggi();
  renderProgressi();
  showToast(\`"\${task.nome}" → \${newStato}\`);
  if (newStato === 'Completate' || newStato === 'Completata') confetti();
  await notionAPI(\`pages/\${dragId}\`, 'PATCH', {
    properties: { Stato: { select: { name: newStato === 'Completate' ? 'Completata' : newStato } } }
  });
  dragId = null;
}

// ============================================================
// SCADENZE
// ============================================================
let starredScadenze = JSON.parse(localStorage.getItem('starredScadenze')||'[]');

function renderScadenze() {
  const now = Date.now();
  const sorted = [...STATE.scadenze]
    .filter(s => !s.completata)
    .sort((a,b) => new Date(a.data)-new Date(b.data));
  
  const el = document.getElementById('scadenzeList');
  if (!sorted.length) { el.innerHTML='<div style="font-size:12px;color:var(--muted)">Nessuna scadenza</div>'; return; }

  el.innerHTML = sorted.slice(0,8).map(s => {
    const d = s.data ? new Date(s.data) : null;
    const diff = d ? Math.ceil((d - now) / 86400000) : null;
    const isUrgente = diff !== null && diff <= 3;
    const starred = starredScadenze.includes(s.id);
    return \`
      <div class="scad-item \${isUrgente?'urgente':''}" \${starred?'style="border-left:2px solid var(--tan);padding-left:8px"':''}>
        \${s.categoria === 'Esame' 
          ? '<span style="color:var(--brown);font-size:14px">📝</span>'
          : \`<button class="scad-star \${starred?'active':''}" onclick="toggleStar('\${s.id}')">★</button>\`}
        <span style="flex:1;font-size:12px">\${s.titolo}</span>
        \${s.priorita ? \`<span class="badge badge-\${s.priorita.toLowerCase()}">\${s.priorita}</span>\`:''}
        <span class="scad-date">\${d ? d.toLocaleDateString('it',{day:'2-digit',month:'short'}) : ''}</span>
      </div>
    \`;
  }).join('');
}

function toggleStar(id) {
  const i = starredScadenze.indexOf(id);
  if (i >= 0) starredScadenze.splice(i,1); else starredScadenze.push(id);
  localStorage.setItem('starredScadenze', JSON.stringify(starredScadenze));
  renderScadenze();
}

// ============================================================
// OBIETTIVI
// ============================================================
function renderObiettivi() {
  const el = document.getElementById('obiettiviList');
  if (!STATE.obiettivi.length) { el.innerHTML='<div style="font-size:12px;color:var(--muted)">Nessun obiettivo</div>'; return; }
  el.innerHTML = STATE.obiettivi.slice(0,5).map(o => {
    const pct = Math.min(100, o.progresso || 0);
    const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--tan)' : 'var(--brown)';
    return \`
      <div class="goal-item">
        <div class="goal-name">\${o.nome}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="goal-bar-wrap" style="flex:1"><div class="goal-bar" style="width:\${pct}%;background:\${color}"></div></div>
          <span style="font-size:10px;color:var(--muted);\${pct>=70?'color:var(--green)':''}">\${pct}%</span>
        </div>
      </div>
    \`;
  }).join('');
}

// ============================================================
// PROGRESSI RINGS
// ============================================================
function renderProgressi() {
  const todayStr = formatDate(TODAY);
  const tasksOggi = STATE.attivita.filter(t => t.scadenza === todayStr || (t.priorita==='Urgente'&&!t.scadenza));
  const taskPct = tasksOggi.length ? Math.round(tasksOggi.filter(t=>t.stato==='Completata').length/tasksOggi.length*100) : 0;
  const obiPct = STATE.obiettivi.length ? Math.round(STATE.obiettivi.filter(o=>o.stato==='Completato').length/STATE.obiettivi.length*100) : 0;
  const habitData = JSON.parse(localStorage.getItem('habitData')||'{}');
  const week = getWeekKey();
  const weekHabits = habitData[week] || {};
  const totalCells = HABITS.length * 7;
  const doneCells = Object.values(weekHabits).reduce((a,v)=>a+Object.values(v).filter(Boolean).length,0);
  const habitPct = totalCells ? Math.round(doneCells/totalCells*100) : 0;

  document.getElementById('progressiRings').innerHTML = [
    [taskPct,'Task','var(--tan)'],
    [obiPct,'Obiettivi','var(--brown)'],
    [habitPct,'Habit','var(--green)'],
  ].map(([pct,label,color]) => \`
    <div class="ring-item">
      \${ringHTML(pct,70,color)}
      <span class="ring-label">\${label}</span>
    </div>
  \`).join('');
}

function ringHTML(pct, size, color) {
  const r = size/2-6; const circ = 2*Math.PI*r;
  const offset = circ-(pct/100*circ);
  const cx = size/2; const cy = size/2;
  return \`<svg class="ring-svg" width="\${size}" height="\${size}" viewBox="0 0 \${size} \${size}">
    <circle class="ring-bg-c" cx="\${cx}" cy="\${cy}" r="\${r}" stroke-width="5"/>
    <circle class="ring-fg-c" cx="\${cx}" cy="\${cy}" r="\${r}" stroke-width="5"
      stroke="\${color}" stroke-linecap="round" stroke-dasharray="\${circ}" stroke-dashoffset="\${offset}"
      style="transform-origin:\${cx}px \${cy}px"/>
    <text x="\${cx}" y="\${cy+5}" text-anchor="middle" class="ring-text" font-family="DM Sans" font-size="\${size>50?13:10}">\${pct}%</text>
  </svg>\`;
}

// ============================================================
// CORSI
// ============================================================
const CORSO_COLORS = {blue:'#3b82f6',green:'#22c55e',purple:'#8b5cf6',orange:'#f97316',red:'#ef4444',tan:'#c5a882'};

function renderCorsi() {
  renderCorsiInto('corsiList', 3);
  renderCorsiInto('corsiListFull', 999);
}

function renderCorsiInto(elId, max) {
  const el = document.getElementById(elId);
  if (!el) return;
  const corsi = STATE.corsi.slice(0, max);
  el.innerHTML = corsi.map(c => corsoCardHTML(c)).join('') +
    \`<div class="corso-card add-corso-card" onclick="showToast('Aggiungi il corso su Notion!')">＋</div>\`;
}

function corsoCardHTML(c) {
  const color = CORSO_COLORS[c.colore] || 'var(--tan)';
  const pct = Math.min(100, c.progressione || 0);
  let countdown = '', cdClass = '';
  if (c.dataEsame) {
    const diff = Math.ceil((new Date(c.dataEsame) - Date.now()) / 86400000);
    if (diff > 30) { countdown = \`Esame: \${diff}gg\`; cdClass = 'green'; }
    else if (diff > 7) { countdown = \`Esame: \${diff}gg\`; cdClass = 'orange'; }
    else if (diff >= 0) { countdown = \`⚠ Esame: \${diff}gg\`; cdClass = 'red'; }
    else { countdown = 'Esame passato'; cdClass = ''; }
  }
  return \`<div class="corso-card" style="border-left-color:\${color}">
    <div class="corso-card-head">
      <span class="corso-emoji">\${getCorsoEmoji(c.nome)}</span>
      <span class="corso-name">\${c.nome}</span>
    </div>
    \${c.docente ? \`<div style="font-size:11px;color:var(--muted)">\${c.docente}</div>\`:''}
    <div class="corso-prog-bar"><div class="corso-prog-fill" style="width:\${pct}%;background:\${color}"></div></div>
    <div class="corso-meta">
      <span>\${pct}%</span>
      \${c.crediti ? \`<span>\${c.crediti} crediti</span>\`:''}
      \${countdown ? \`<span class="corso-countdown \${cdClass}">\${countdown}</span>\`:''}
    </div>
  </div>\`;
}

function getCorsoEmoji(nome) {
  const n = nome.toLowerCase();
  if (n.includes('python') || n.includes('data science')) return '🐍';
  if (n.includes('big data') || n.includes('analytic')) return '📊';
  if (n.includes('machine') || n.includes('ml') || n.includes('ai')) return '🤖';
  if (n.includes('engineering') || n.includes('data eng')) return '📐';
  if (n.includes('sql') || n.includes('database')) return '🗄️';
  if (n.includes('cloud')) return '☁️';
  return '📚';
}

// ============================================================
// PLANNER
// ============================================================
const FASCE = ['Mattina','Pomeriggio','Sera'];
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function renderPlanner() {
  const saved = JSON.parse(localStorage.getItem('planner')||'{}');
  const startOfWeek = new Date(TODAY);
  const dow = TODAY.getDay() === 0 ? 6 : TODAY.getDay()-1;
  startOfWeek.setDate(TODAY.getDate()-dow);

  let html = '<div class="planner-label"></div>';
  for (let i=0;i<7;i++) {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate()+i);
    const isOggi = formatDate(d) === formatDate(TODAY);
    html += \`<div class="planner-head \${isOggi?'oggi':''}">\${GIORNI[i]} \${d.getDate()}</div>\`;
  }
  
  FASCE.forEach(fascia => {
    html += \`<div class="planner-label">\${fascia}</div>\`;
    for (let i=0;i<7;i++) {
      const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate()+i);
      const key = \`\${formatDate(d)}_\${fascia}\`;
      const isOggi = formatDate(d) === formatDate(TODAY);
      html += \`<div class="planner-cell \${isOggi?'oggi':''}">
        <textarea placeholder="..." id="plan_\${key}">\${saved[key]||''}</textarea>
      </div>\`;
    }
  });

  document.getElementById('plannerGrid').innerHTML = html;
}

function savePlanner() {
  const data = {};
  document.querySelectorAll('[id^="plan_"]').forEach(el => {
    if (el.value.trim()) data[el.id.replace('plan_','')] = el.value.trim();
  });
  localStorage.setItem('planner', JSON.stringify(data));
  showToast('Planner salvato ✓');
}

// ============================================================
// ROADMAP / SKILL MAP
// ============================================================
const SKILL_AREAS = {
  'Python & Coding': ['Python avanzato','NumPy / Pandas','SQL','Git & GitHub','Linux CLI'],
  'ML & AI': ['Scikit-learn','Deep Learning','NLP','LLM & Prompting','MLflow'],
  'Data Engineering': ['Spark','Kafka','Airflow','dbt','Databricks'],
  'Cloud & DevOps': ['AWS/GCP basics','Docker','Kubernetes','CI/CD','API design'],
};

let skillStates = JSON.parse(localStorage.getItem('skillStates')||'{}');

function renderSkillMap() {
  const el = document.getElementById('skillMap');
  if (!el) return;
  const stateOrder = ['studiare','studio','acquisita'];
  const stateLabels = {'studiare':'Da studiare','studio':'In studio','acquisita':'Acquisita'};
  
  el.innerHTML = Object.entries(SKILL_AREAS).map(([area, skills]) => \`
    <div class="skill-area">
      <div class="skill-area-title">\${area}</div>
      \${skills.map(skill => {
        const state = skillStates[skill] || 'studiare';
        return \`<span class="skill-tag \${state}" onclick="cycleSkill('\${skill}')">\${skill} ·\${stateLabels[state]}</span>\`;
      }).join('')}
    </div>
  \`).join('');
}

function cycleSkill(skill) {
  const order = ['studiare','studio','acquisita'];
  const cur = skillStates[skill] || 'studiare';
  skillStates[skill] = order[(order.indexOf(cur)+1) % order.length];
  localStorage.setItem('skillStates', JSON.stringify(skillStates));
  renderSkillMap();
}

// ============================================================
// HABIT TRACKER
// ============================================================
const HABITS = [
  'Studio 📚','Esercizio 🏃','Lettura 📖','Acqua 💧','Meditazione 🧘','Coding 💻'
];

function renderHabitGrid() {
  const today = new Date();
  const dow = today.getDay() === 0 ? 6 : today.getDay()-1;
  const week = getWeekKey();
  const saved = JSON.parse(localStorage.getItem('habitData')||'{}');
  const weekData = saved[week] || {};

  let html = '<div class="habit-head"></div>';
  GIORNI.forEach(g => html += \`<div class="habit-head">\${g}</div>\`);
  
  HABITS.forEach((h,hi) => {
    html += \`<div class="habit-name">\${h}</div>\`;
    for (let d=0;d<7;d++) {
      const key = \`\${hi}_\${d}\`;
      const done = weekData[key];
      html += \`<div class="habit-cell">
        <div class="habit-circle \${done?'done':''}" onclick="toggleHabit(\${hi},\${d})">\${done?'✓':''}</div>
      </div>\`;
    }
  });
  
  document.getElementById('habitGrid').innerHTML = html;
  renderProgressi();
}

function toggleHabit(hi, d) {
  const week = getWeekKey();
  const saved = JSON.parse(localStorage.getItem('habitData')||'{}');
  if (!saved[week]) saved[week] = {};
  const key = \`\${hi}_\${d}\`;
  saved[week][key] = !saved[week][key];
  localStorage.setItem('habitData', JSON.stringify(saved));
  renderHabitGrid();
}

function getWeekKey() {
  const d = new Date(TODAY);
  const dow = d.getDay()===0?6:d.getDay()-1;
  d.setDate(d.getDate()-dow);
  return formatDate(d);
}

// ============================================================
// RETROSPETTIVA
// ============================================================
function saveRetro() {
  const data = {
    obiettivi: document.getElementById('retroObiettivi').value,
    completato: document.getElementById('retroCompletato').value,
    migliorare: document.getElementById('retroMigliorare').value,
    voto: document.getElementById('votoSlider').value,
    data: formatDate(TODAY),
  };
  const key = \`retro_\${getWeekKey()}\`;
  localStorage.setItem(key, JSON.stringify(data));
  showToast('Retrospettiva salvata ✓');
}

function loadRetro() {
  const key = \`retro_\${getWeekKey()}\`;
  const data = JSON.parse(localStorage.getItem(key)||'null');
  if (data) {
    document.getElementById('retroObiettivi').value = data.obiettivi || '';
    document.getElementById('retroCompletato').value = data.completato || '';
    document.getElementById('retroMigliorare').value = data.migliorare || '';
    document.getElementById('votoSlider').value = data.voto || 7;
    document.getElementById('votoDisplay').textContent = data.voto || 7;
  }
}

// ============================================================
// QUICK NOTES
// ============================================================
let notes = JSON.parse(localStorage.getItem('quickNotes')||'[]');

function addNote() {
  const input = document.getElementById('noteInput');
  const text = input.value.trim();
  if (!text) return;
  const note = {text, time: new Date().toLocaleTimeString('it',{hour:'2-digit',minute:'2-digit'})};
  notes.unshift(note);
  notes = notes.slice(0,4);
  localStorage.setItem('quickNotes', JSON.stringify(notes));
  input.value = '';
  renderNotes();
  // Also save to Notion as task
  notionAPI(\`databases/${DB.attivita}/query\`).then(() => {
    notionAPI('pages','POST',{
      parent:{database_id:'${DB.attivita}'},
      properties:{
        Nome:{title:[{text:{content:text}}]},
        Stato:{select:{name:'Da fare'}},
        Scadenza:{date:{start:formatDate(TODAY)}},
      }
    });
  });
}

function renderNotes() {
  document.getElementById('noteList').innerHTML = notes.map((n,i) => \`
    <div class="note-item">
      <span class="note-time">\${n.time}</span>
      <span style="flex:1">\${n.text}</span>
      <button class="note-del" onclick="deleteNote(\${i})">×</button>
    </div>
  \`).join('');
}

function deleteNote(i) {
  notes.splice(i,1);
  localStorage.setItem('quickNotes', JSON.stringify(notes));
  renderNotes();
}

// ============================================================
// POMODORO
// ============================================================
let pomoSeconds = 50*60, pomoRunning = false, pomoInterval = null, pomoTomatoes = 0;

function pomoToggle() {
  pomoRunning = !pomoRunning;
  document.getElementById('pomoBtnStart').textContent = pomoRunning ? '⏸' : '▶';
  if (pomoRunning) {
    pomoInterval = setInterval(() => {
      pomoSeconds--;
      updatePomoUI();
      if (pomoSeconds <= 0) {
        pomoDone();
      }
    }, 1000);
  } else {
    clearInterval(pomoInterval);
  }
}

function pomoReset() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoSeconds = 50*60;
  document.getElementById('pomoBtnStart').textContent = '▶';
  updatePomoUI();
}

function pomoDone() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoTomatoes++;
  pomoSeconds = 50*60;
  document.getElementById('pomoBtnStart').textContent = '▶';
  document.getElementById('pomoTomatoes').textContent = \`🍅 ×\${pomoTomatoes}\`;
  updatePomoUI();
  playBell();
  showToast('🍅 Pomodoro completato!');
  confetti();
}

function updatePomoUI() {
  const total = 50*60;
  const min = Math.floor(pomoSeconds/60);
  const sec = pomoSeconds % 60;
  document.getElementById('pomoTime').textContent = \`\${String(min).padStart(2,'0')}:\${String(sec).padStart(2,'0')}\`;
  const pct = pomoSeconds / total;
  const circ = 2*Math.PI*34;
  const offset = circ * (1-pct);
  const arc = document.getElementById('pomoArc');
  arc.style.strokeDashoffset = offset;
  const r = pct > .5 ? 'var(--green)' : pct > .2 ? 'var(--orange)' : 'var(--red)';
  arc.style.stroke = r;
}

function playBell() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [0,0.4,0.8].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime+t);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+t+0.5);
      osc.start(ctx.currentTime+t);
      osc.stop(ctx.currentTime+t+0.5);
    });
  } catch(e){}
}

// ============================================================
// CONFETTI
// ============================================================
function confetti() {
  const colors = ['var(--tan)','var(--green)','var(--brown)','#f5d06e','#a0c8a0'];
  for (let i=0;i<20;i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = \`left:\${Math.random()*100}vw;top:-10px;background:\${colors[Math.random()*colors.length|0]};border-radius:\${Math.random()>0.5?'50%':'2px'};animation-delay:\${Math.random()*.5}s;animation-duration:\${1+Math.random()}s\`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

// ============================================================
// BRIEFING
// ============================================================
const QUOTES = [
  'Ogni esperto è stato un principiante.',
  'Il codice è poesia per le macchine.',
  'I dati sono il nuovo petrolio. Tu sei il raffinatore.',
  'Un algoritmo alla volta, un passo alla volta.',
  'La curiosità è il motore dell\'AI engineer.',
  'Fallire veloce, imparare veloce.',
];

function showBriefing() {
  const key = \`briefing_\${formatDate(TODAY)}\`;
  if (localStorage.getItem(key)) return;
  
  document.getElementById('briefingDate').textContent = TODAY.toLocaleDateString('it',{weekday:'long',day:'numeric',month:'long'});
  
  const todayStr = formatDate(TODAY);
  const urgent = STATE.attivita.filter(t => t.scadenza===todayStr && t.priorita==='Urgente' && t.stato!=='Completata');
  const el1 = document.getElementById('briefingUrgenti');
  el1.innerHTML = urgent.length ? urgent.map(t=>\`<div class="briefing-item">\${t.nome}</div>\`).join('') : '<div class="briefing-item" style="color:var(--muted)">Nessuna urgenza 👌</div>';

  const soon = STATE.scadenze.filter(s => {
    if (!s.data || s.completata) return false;
    const diff = Math.ceil((new Date(s.data)-Date.now())/86400000);
    return diff >= 0 && diff <= 3;
  });
  const el2 = document.getElementById('briefingScadenze');
  el2.innerHTML = soon.length ? soon.map(s=>\`<div class="briefing-item">\${s.titolo} — \${new Date(s.data).toLocaleDateString('it',{day:'2-digit',month:'short'})}</div>\`).join('') : '<div class="briefing-item" style="color:var(--muted)">Tutto tranquillo 🎯</div>';

  document.getElementById('briefingQuote').textContent = '"' + QUOTES[Math.floor(Math.random()*QUOTES.length)] + '"';
  document.getElementById('briefing').style.display = 'flex';
}

function closeBriefing() {
  document.getElementById('briefing').style.display = 'none';
  localStorage.setItem(\`briefing_\${formatDate(TODAY)}\`, '1');
}

// ============================================================
// NAVIGATION
// ============================================================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  const navBtn = document.getElementById('nav-'+name);
  if (navBtn) navBtn.classList.add('active');
  if (name === 'habit') renderHabitGrid();
  if (name === 'roadmap') renderSkillMap();
  if (name === 'retro') loadRetro();
  if (name === 'corsi') renderCorsi();
}

// ============================================================
// TOAST
// ============================================================
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}

// ============================================================
// UTILS
// ============================================================
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

// ============================================================
// INIT
// ============================================================
renderNotes();
renderPlanner();
renderDemoData(); // show demo immediately

loadData().then(() => {
  setTimeout(showBriefing, 800);
});
</script>
</body>
</html>`;
