/* Shared agent dock: original same-origin engines, retained per-agent sessions. */
(function(){
  if(window.__agentDock)return;window.__agentDock=true;
  var R=location.pathname.indexOf('/beehive-nature/')===0?'/beehive-nature/surfaces/':'/surfaces/';
  var agents=[
    {id:'queen',name:'bQueenBee',icon:'🐝',label:'Ask about BNR',src:R+'bqueenbee-live.html?dock=8',note:'Machine agent · answers from BNR’s written knowledge and public sources.'},
    {id:'hearth',name:'heARTh',icon:'🔥',label:'Explore a creative idea',src:R+'blight/hearth.html?dock=8',note:'Creative prompt router · try a mushroom, a melody or a gallery idea.'},
    {id:'baigents',name:'bAigents',icon:'🤖',label:'See what is built',note:'Build status · this is a project overview, not a connected chat agent.'},
    {id:'bloverai',name:'bLOVErAi',icon:'💌',label:'Prepare an AI handoff',note:'Draft a prompt to take to your own AI. Nothing is sent to another service.'}
  ];
  var current=agents[0],sessions={},expanded=false,helpOpen=false,fitDock=function(){},installEvt=null;
  var css=document.createElement('style');
  css.textContent=`
    #adOrb,#adWin,#adWin *{box-sizing:border-box}
    #adOrb{position:fixed;left:16px;bottom:66px;z-index:9999;width:52px;height:52px;min-height:44px;padding:0;margin:0;border:1px solid #729889;border-radius:50%;background:#0e1b19;color:#8cdae0;font:26px/1 system-ui;display:grid;place-items:center;cursor:pointer;box-shadow:0 3px 16px #0002}
    #adWin{--ad-bg:#10191c;--ad-panel:#18252a;--ad-ink:#eef7f2;--ad-dim:#b8ccc7;--ad-line:#526e72;--ad-accent:#b9a4f5;--ad-on:#18132b;--ad-font:system-ui,-apple-system,'Segoe UI',sans-serif;position:fixed;left:12px;bottom:82px;z-index:10000;width:min(520px,calc(100% - 24px));height:min(680px,calc(100dvh - 96px));min-height:0;display:none;flex-direction:column;margin:0;padding:0;overflow:hidden;border:1px solid var(--ad-line);border-radius:18px;background:var(--ad-bg);color:var(--ad-ink);font:16px/1.5 var(--ad-font);text-align:start;letter-spacing:normal;box-shadow:0 16px 50px #0004;color-scheme:dark}
    #adWin.on{display:flex}#adWin.is-expanded{width:min(920px,calc(100% - 24px))}#adWin [hidden]{display:none!important}
    #adWin button,#adWin textarea,#adWin a{font:inherit;letter-spacing:normal;text-transform:none;box-shadow:none}
    #adWin button{appearance:none;position:static;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;width:auto;height:auto;margin:0;padding:8px 12px;border:1px solid var(--ad-line);border-radius:9px;background:var(--ad-panel);color:var(--ad-ink);text-align:center;cursor:pointer;white-space:normal;transform:none;opacity:1}
    #adWin button:disabled{opacity:.55;cursor:default}#adWin button:hover:not(:disabled){border-color:var(--ad-accent)}
    #adWin a{color:var(--ad-ink);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
    #adWin button:focus-visible,#adWin a:focus-visible,#adWin summary:focus-visible,#adWin textarea:focus-visible,#adOrb:focus-visible{outline:3px solid var(--ad-accent,#326b39);outline-offset:-3px}
    #adHead{display:flex;align-items:center;gap:6px;padding:8px 12px;flex:none;border-bottom:1px solid var(--ad-line);background:var(--ad-panel)}
    #adTitle{font:600 1rem/1.4 var(--ad-font);margin:0 auto 0 0;color:var(--ad-ink)}#adHead button{font-size:.875rem;padding:6px 8px;background:transparent}
    #adAgents{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:10px 12px;flex:none}
    #adWin .adAg{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:start;padding:8px 10px}
    #adWin .adAg strong{font:600 .9375rem/1.3 var(--ad-font)}#adWin .adAg small{font:.75rem/1.3 var(--ad-font);color:var(--ad-dim)}
    #adWin .adAg[aria-pressed=true]{border-color:var(--ad-accent);background:var(--ad-accent);color:var(--ad-on)}#adWin .adAg[aria-pressed=true] small{color:inherit}#adWin .adAg[aria-pressed=true] strong::before{content:'✓ ';font:inherit}
    #adBody{display:flex;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;border-top:1px solid var(--ad-line)}#adBody.has-frame{overflow:hidden}
    #adWin .adSession{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}#adWin iframe{display:block;flex:1;width:100%;height:100%;min-height:0;border:0;background:var(--ad-bg)}
    #adWin .adPanel{padding:16px;overflow:auto;min-height:0;overflow-wrap:anywhere}#adWin .adPanel h2{font:600 1.1rem/1.4 var(--ad-font);color:var(--ad-ink);margin:0 0 12px}#adWin .adPanel p{margin:0 0 12px}
    #adWin .adPanel pre{font:.875rem/1.6 var(--ad-font);white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--ad-line);border-radius:8px;background:var(--ad-panel);padding:12px;margin:12px 0;color:var(--ad-ink);user-select:text}
    #adContext{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px;padding:8px 12px;flex:none;border-top:1px solid var(--ad-line);font:.75rem/1.4 var(--ad-font);color:var(--ad-dim)}#adOpenPage{margin-inline-start:auto;min-height:32px;display:inline-flex;align-items:center}
    #adFoot{display:flex;gap:8px;align-items:flex-end;padding:8px 12px 4px;flex:none}
    #adPrompt{flex:1;min-width:0;width:100%;min-height:52px;max-height:120px;margin:0;padding:10px 12px;resize:vertical;background:var(--ad-panel);color:var(--ad-ink);border:1px solid var(--ad-line);border-radius:10px;font:16px/1.4 var(--ad-font)}#adPrompt::placeholder{color:var(--ad-dim);opacity:1}
    #adWin #adSend{background:var(--ad-accent);color:var(--ad-on);border-color:var(--ad-accent);min-height:48px}
    #adStatus{margin:0;padding:4px 12px 10px;min-height:32px;flex:none;font:.75rem/1.4 var(--ad-font);color:var(--ad-dim)}#adStatus[data-error=true]{color:var(--ad-ink);font-weight:600}
    body[data-reg=bee] #adOrb{background:#fff;color:#326b39;border-color:#ccd7cf}
    body[data-reg=bee] #adWin{--ad-bg:#f6f7f2;--ad-panel:#fff;--ad-ink:#18362a;--ad-dim:#435f4e;--ad-line:#bdcec3;--ad-accent:#326b39;--ad-on:#fff;color-scheme:light}
    body[data-reg=raver] #adHead{background:linear-gradient(110deg,#302045,#123339 70%,#19352c)}
    body[data-reg=cypherpunk] #adWin{--ad-bg:#0e141a;--ad-panel:#151e26;--ad-ink:#e4f2f4;--ad-dim:#adbecb;--ad-line:#526b7c;--ad-accent:#80cddd;--ad-on:#0e141a;--ad-font:ui-monospace,Consolas,monospace;border-radius:5px;font-size:14px}body[data-reg=cypherpunk] #adWin button{border-radius:3px}
    @media(max-width:520px){#adWin{left:8px;width:calc(100% - 16px);border-radius:12px}#adWin.is-expanded{width:calc(100% - 16px)}#adAgents{padding:6px 8px;gap:4px}#adHead,#adContext{padding-inline:8px}#adFoot{padding-inline:8px}#adContext{font-size:.6875rem}#adWin .adAg{padding:6px 8px}#adTitle{font-size:.9375rem}}
    @media(max-height:500px){#adWin .adAg small{display:none}#adContext{display:none}#adAgents{padding-block:4px}#adStatus{padding-bottom:4px}#adPrompt{min-height:44px;max-height:64px}}
    @media(prefers-reduced-motion:reduce){#adWin,#adOrb,#adWin *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
  `;
  document.head.appendChild(css);
  function make(tag,id){var el=document.createElement(tag);if(id)el.id=id;return el;}
  var orb=make('button','adOrb');orb.type='button';orb.textContent='⚙';orb.title='Agent dock · Alt+/';orb.setAttribute('aria-label','Open the agent dock');orb.setAttribute('aria-controls','adWin');orb.setAttribute('aria-expanded','false');
  var win=make('div','adWin');win.setAttribute('role','dialog');win.setAttribute('aria-labelledby','adTitle');
  win.innerHTML='<div id="adHead"><h2 id="adTitle">Agent dock</h2><button id="adHelpButton" type="button" aria-pressed="false">Help</button><button id="adExpand" type="button" aria-pressed="false" aria-label="Expand the agent dock">Expand</button><button id="adClose" type="button" aria-label="Close the agent dock">✕</button></div><div id="adAgents" role="group" aria-label="Choose an agent"></div><div id="adBody"></div><div id="adContext"><span id="adNote"></span><a id="adOpenPage" target="_blank" rel="noopener noreferrer">Open page ↗ (new tab)</a></div><form id="adFoot"><textarea id="adPrompt" rows="2" maxlength="4000" aria-label="Message" aria-describedby="adStatus" placeholder="What would you like to explore?"></textarea><button id="adSend" type="submit">Send</button></form><p id="adStatus" role="status" aria-live="polite">Conversations stay in this page until you leave or reload.</p>';
  document.body.appendChild(orb);document.body.appendChild(win);
  var $=function(id){return document.getElementById(id);},body=$('adBody'),prompt=$('adPrompt'),foot=$('adFoot'),status=$('adStatus');
  var help=make('div','adHelp');help.className='adPanel';help.hidden=true;
  help.innerHTML='<h2>A little help</h2><p>Choose an agent, then write a message. Your drafts and conversations stay here while you switch agents or views. Leaving or reloading this page clears them.</p><p>bQueenBee uses BNR’s written knowledge. heARTh routes creative prompts to existing tools. bAigents shows build status. bLOVErAi prepares text for an AI you choose.</p><p>Links inside the dock open a new tab, so your conversation stays here.</p><p>Enter sends. Shift+Enter adds a line. Escape closes. Alt+/ opens or closes; Alt+1–4 chooses an agent.</p><h2>Use BNR from your home screen</h2><p>Where supported, use your browser’s “Install app” or “Add to Home Screen” option. On Safari, look in the Share menu.</p>';
  body.appendChild(help);
  function notice(text,error){status.textContent=text;status.setAttribute('data-error',String(!!error));}
  function session(a){
    if(sessions[a.id])return sessions[a.id];
    var s={agent:a,draft:'',ready:false,panel:make('div'),frame:null,handoff:[],status:'',error:false};
    s.panel.className='adSession';s.panel.hidden=true;sessions[a.id]=s;body.appendChild(s.panel);
    if(a.src){s.frame=make('iframe');s.frame.title=a.name+' conversation';s.frame.addEventListener('load',function(){prepareFrame(s,true);if(current===a)updateComposer();});s.frame.src=a.src;s.panel.appendChild(s.frame);}
    else{
      s.panel.className+=' adPanel';
      if(a.id==='baigents')s.panel.innerHTML='<h2>What is built?</h2><p>The metering components have tests. A connected agent mesh is not available from this dock.</p><p>There is no chat endpoint behind this card, so it does not accept a message.</p><p><a href="'+R+'bmeshasi.html" target="_blank" rel="noopener noreferrer">Read the exchange overview ↗ (new tab)</a></p>';
      else s.panel.innerHTML='<h2>Take a good question with you</h2><p>Write what you want to explore. Build a handoff, then copy it into an AI you already use.</p><div class="adHandoff"></div><button type="button" class="adCopy" hidden>Copy handoff</button>';
      s.ready=true;
    }return s;
  }
  function expectedFrame(s){
    try{var wanted=new URL(s.agent.src,location.href),actual=new URL(s.frame.contentWindow.location.href);if(actual.origin!==location.origin||actual.pathname!==wanted.pathname)return null;
      var w=s.frame.contentWindow,d=s.frame.contentDocument;return d&&d.getElementById('q')&&typeof w.ask==='function'?{window:w,document:d}:null;
    }catch(e){return null;}
  }
  var frameCss=`
    html.ad-embedded{--bg:#10191c;--ink:#eef7f2;--dim:#b8ccc7;--line:#526e72;--gold:#b9a4f5;--cyan:#8cdae0;--violet:#cbb4ff;--amber:#f4c897;--ad-panel:#18252a;color-scheme:dark}
    html.ad-embedded[data-ad-view=bee]{--bg:#f6f7f2;--ink:#18362a;--dim:#435f4e;--line:#bdcec3;--gold:#326b39;--cyan:#29628f;--violet:#65509a;--amber:#876119;--ad-panel:#fff;color-scheme:light}
    html.ad-embedded[data-ad-view=cypherpunk]{--bg:#0e141a;--ink:#e4f2f4;--dim:#adbecb;--line:#526b7c;--gold:#80cddd;--cyan:#80cddd;--ad-panel:#151e26}
    html.ad-embedded body{min-height:0!important;margin:0!important;padding:12px!important;background:var(--bg)!important;color:var(--ink)!important;font:16px/1.65 system-ui,-apple-system,'Segoe UI',sans-serif!important;overflow-wrap:anywhere}
    html.ad-embedded[data-ad-view=cypherpunk] body{font:14px/1.6 ui-monospace,Consolas,monospace!important}
    html.ad-embedded :is(#tbar,#tbarMore,#bregbar,#bregctl,#blangctl,#railsbadge,#bnr-beta-badge,body>header,body>footer,#drops,#debut){display:none!important}
    html.ad-embedded main>section:not(.adConversation){display:none!important}
    html.ad-embedded main,html.ad-embedded .adConversation{max-width:none;margin:0;padding:0;border:0;background:transparent}
    html.ad-embedded #chat{margin:0;min-height:0;gap:12px;max-width:none}
    html.ad-embedded .msg{max-width:100%;font:inherit!important;background:var(--ad-panel)!important;color:var(--ink)!important;border:1px solid var(--line);padding:12px;border-radius:12px;overflow-wrap:anywhere}
    html.ad-embedded .msg:is(.you,.user){margin-inline-start:20px;border-inline-start:3px solid var(--violet)}
    html.ad-embedded .msg:is(.bee,.ai){margin-inline-end:12px;border-inline-start:3px solid var(--cyan)}
    html.ad-embedded :is(.who,.machine,.badge,.note,.law,.vnote,.msg a,.msg pre){font-size:13px!important;letter-spacing:normal!important;color:var(--dim)}
    html.ad-embedded .msg a{color:var(--cyan)!important;background:transparent!important;border-color:var(--line)!important;box-shadow:none!important;font-size:inherit!important;text-decoration:underline}
    html.ad-embedded .msg pre{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink)!important}
    html.ad-embedded button,html.ad-embedded summary{font:inherit!important;min-height:44px;max-width:100%;white-space:normal;padding:8px 10px;border-radius:8px;color:var(--ink)!important;background:var(--ad-panel)!important;border-color:var(--line)!important;opacity:1}
    html.ad-embedded button[aria-pressed=true]{outline:2px solid var(--violet);outline-offset:-2px}
    html.ad-embedded :is(button,a,summary):focus-visible{outline:3px solid var(--cyan);outline-offset:-3px}
    html.ad-embedded #q,html.ad-embedded #ask>button:not(#micb):not(#autov){display:none!important}
    html.ad-embedded #ask{flex-wrap:wrap;margin-block:12px}
    html.ad-embedded .adTools{margin-top:16px;padding-top:10px;border-top:1px solid var(--line)}
    html.ad-embedded .adTools summary{background:transparent;border:0;cursor:pointer;font-weight:600!important}
    html.ad-embedded .adTools :is(h2,.note){margin-top:10px;text-align:start}
    html.ad-embedded .adLinkNote{font-size:.75em}
    @media(prefers-reduced-motion:reduce){html.ad-embedded *{scroll-behavior:auto!important;transition:none!important}}
  `;
  function retargetLinks(d){d.querySelectorAll('a[href]').forEach(function(a){
    try{var u=new URL(a.getAttribute('href'),d.location.href);if(!/^https?:$/.test(u.protocol))return;if(u.pathname===d.location.pathname&&u.origin===location.origin&&u.hash)return;
      a.target='_blank';a.rel='noopener noreferrer';if(!a.querySelector('.adLinkNote')){var n=d.createElement('span');n.className='adLinkNote';n.textContent=' ↗ (new tab)';a.appendChild(n);}
    }catch(e){}
  });}
  function suspend(s,inactive){var f=s.frame&&expectedFrame(s);if(f&&typeof f.window.bnrDockSuspend==='function')f.window.bnrDockSuspend(inactive);}
  function prepareFrame(s,loaded){
    var f=expectedFrame(s);s.ready=!!f;if(!f){s.status='This agent could not open here. Your draft is kept. Use Open page to continue.';s.error=true;return;}
    var d=f.document;d.documentElement.classList.add('ad-embedded');d.documentElement.setAttribute('data-ad-view',document.body.getAttribute('data-reg')||'bee');d.body.setAttribute('data-reg',document.body.getAttribute('data-reg')||'bee');
    if(!d.getElementById('adReading')){
      var st=d.createElement('style');st.id='adReading';st.textContent=frameCss;d.head.appendChild(st);
      var chat=d.getElementById('chat'),container=s.agent.id==='queen'?chat.closest('section'):d.body;
      var details=d.createElement('details');details.className='adTools';var summary=d.createElement('summary');summary.textContent=s.agent.id==='queen'?'Suggestions, voice and sources':'Creative suggestions';details.appendChild(summary);
      if(s.agent.id==='queen'){
        container.classList.add('adConversation');Array.from(container.children).forEach(function(el){if(el!==chat)details.appendChild(el);});container.appendChild(details);
        var mic=d.getElementById('micb');if(mic)mic.title='Browser microphone. Your browser may use an online speech service.';
      }else{
        if(!chat.children.length){var welcome=d.createElement('div');welcome.className='msg ai';welcome.textContent='Bring a creative idea. Try “grow a mushroom” or “make a melody”. I use BNR’s existing generators.';chat.appendChild(welcome);}
        ['seeds','ask'].forEach(function(id){var el=d.getElementById(id);if(el)details.appendChild(el);});var note=d.querySelector('.note');if(note)details.appendChild(note);chat.after(details);
      }
      chat.setAttribute('role','log');chat.setAttribute('aria-label',s.agent.name+' conversation');chat.setAttribute('aria-live','polite');
      retargetLinks(d);new MutationObserver(function(){retargetLinks(d);}).observe(d.body,{childList:true,subtree:true});
      d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a)retargetLinks(d);},true);d.addEventListener('keydown',shortcut);
      // The full-page greeting may have scrolled before compact mode was applied.
      f.window.scrollTo(0,0);
    }
    if(loaded){s.status='';s.error=false;}suspend(s,!win.classList.contains('on')||s.agent!==current||helpOpen);
  }
  document.addEventListener('bregister',function(){Object.keys(sessions).forEach(function(id){var s=sessions[id];if(s.frame&&s.ready)prepareFrame(s);});});
  function updateComposer(){
    var s=sessions[current.id];if(!s)return;foot.hidden=helpOpen||current.id==='baigents';$('adSend').disabled=!!current.src&&!s.ready;$('adSend').textContent=current.id==='bloverai'?'Build handoff':'Send';
    prompt.setAttribute('aria-label',current.id==='bloverai'?'Question for your handoff':'Message '+current.name);prompt.placeholder=current.id==='bloverai'?'What would you like to ask your AI?':'Ask '+current.name+'…';
    $('adNote').textContent=current.note;$('adOpenPage').hidden=!current.src;$('adOpenPage').href=current.src||R+'bmeshasi.html';
    notice(s.status||(current.src&&!s.ready?'Opening '+current.name+'… You can write while it loads.':'Kept in this page only · Enter sends · Shift+Enter adds a line.'),s.error);
  }
  function showCurrent(){
    session(current);Object.keys(sessions).forEach(function(id){var s=sessions[id];s.panel.hidden=helpOpen||id!==current.id;suspend(s,s.panel.hidden||!win.classList.contains('on'));});
    help.hidden=!helpOpen;body.classList.toggle('has-frame',!!current.src&&!helpOpen);$('adHelpButton').setAttribute('aria-pressed',String(helpOpen));updateComposer();
  }
  agents.forEach(function(a){var b=make('button');b.type='button';b.className='adAg';b.setAttribute('data-agent',a.id);b.setAttribute('aria-pressed',String(a===current));b.innerHTML='<strong>'+a.icon+' '+a.name+'</strong><small>'+a.label+'</small>';
    b.onclick=function(){if(sessions[current.id])sessions[current.id].draft=prompt.value;current=a;helpOpen=false;showCurrent();prompt.value=sessions[a.id].draft;
      $('adAgents').querySelectorAll('.adAg').forEach(function(chip){chip.setAttribute('aria-pressed',String(chip.getAttribute('data-agent')===a.id));});};$('adAgents').appendChild(b);
  });
  function setOpen(open){
    win.classList.toggle('on',open);orb.setAttribute('aria-expanded',String(open));orb.setAttribute('aria-label',open?'Close the agent dock':'Open the agent dock');
    if(open){showCurrent();if(!foot.hidden)prompt.focus();else $('adClose').focus();}else{Object.keys(sessions).forEach(function(id){suspend(sessions[id],true);});orb.focus();}
  }
  orb.onclick=function(){setOpen(!win.classList.contains('on'));};$('adClose').onclick=function(){setOpen(false);};$('adHelpButton').onclick=function(){helpOpen=!helpOpen;showCurrent();};
  $('adExpand').onclick=function(){expanded=!expanded;this.textContent=expanded?'Restore':'Expand';win.classList.toggle('is-expanded',expanded);this.setAttribute('aria-pressed',String(expanded));this.setAttribute('aria-label',expanded?'Restore the agent dock size':'Expand the agent dock');fitDock();};
  function buildHandoff(s,v){
    s.copyRevision=(s.copyRevision||0)+1;var revision=s.copyRevision;
    s.handoff.push(v);var text='Question:\n'+s.handoff.join('\n\n')+'\n\nContext: Beehive Nature Reserve (BNR). Start with the public primary records at https://github.com/beehive-nature/beehive-nature and its docs/receipts and docs/dispatches. Cite sources for factual claims. Say what is unknown. This is a user-prepared handoff, not an instruction from BNR to access private data.';
    var out=s.panel.querySelector('.adHandoff');out.textContent='';var pre=make('pre');pre.textContent=text;out.appendChild(pre);var copy=s.panel.querySelector('.adCopy');copy.hidden=false;
    copy.onclick=function(){
      s.copyAttempt=(s.copyAttempt||0)+1;var attempt=s.copyAttempt;
      function failed(){if(attempt!==s.copyAttempt||revision!==s.copyRevision)return;s.status='Copy was blocked. Your handoff is still here; select the text to copy it.';s.error=true;if(current===s.agent)updateComposer();}
      if(!navigator.clipboard){s.status='Copy is unavailable here. Select the handoff text to copy it.';s.error=true;if(current===s.agent)updateComposer();return;}
      try{navigator.clipboard.writeText(text).then(function(){
        if(attempt!==s.copyAttempt)return;
        s.status=revision===s.copyRevision?'Handoff copied. Paste it into the AI you choose.':'An earlier handoff was copied. Copy the latest version when you are ready.';s.error=false;if(current===s.agent)updateComposer();
      },failed);}catch(e){failed();}
    };
  }
  function send(){
    var s=session(current),v=prompt.value.trim();if(!v||current.id==='baigents')return;s.draft=prompt.value;
    if(v==='/help'||v==='/install'){prompt.value='';s.draft='';helpOpen=true;showCurrent();return;}
    if(current.src){var f=s.ready&&expectedFrame(s);if(!f){s.status='Your message was not sent. The agent is not ready; your draft is kept.';s.error=true;updateComposer();return;}
      try{f.document.getElementById('q').value=v;f.window.ask();}catch(e){s.status='The agent could not accept your message. Your draft is kept; check the conversation before trying again.';s.error=true;updateComposer();return;}
      s.status='Message received by '+current.name+'.';
    }else{buildHandoff(s,v);s.status='Handoff prepared here. Copy it when you are ready.';}
    s.error=false;prompt.value='';s.draft='';updateComposer();prompt.focus();
  }
  foot.addEventListener('submit',function(e){e.preventDefault();send();});prompt.addEventListener('input',function(){if(sessions[current.id])sessions[current.id].draft=prompt.value;});
  prompt.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();send();}});
  function shortcut(e){if(e.isComposing)return;if(e.key==='Escape'&&win.classList.contains('on')){e.preventDefault();setOpen(false);return;}if(!e.altKey)return;var k=e.key.toLowerCase();
    if(k==='/'||k==='m'){e.preventDefault();setOpen(!win.classList.contains('on'));}else if(k==='h'){e.preventDefault();setOpen(true);}else if(/^[1-4]$/.test(k)){e.preventDefault();$('adAgents').querySelectorAll('.adAg')[Number(k)-1].click();setOpen(true);}
  }
  document.addEventListener('keydown',shortcut);window.addEventListener('pagehide',function(){Object.keys(sessions).forEach(function(id){suspend(sessions[id],true);});});
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installEvt=e;if($('adInstall'))return;var install=make('button','adInstall');install.type='button';install.textContent='Install BNR';install.onclick=function(){if(installEvt){installEvt.prompt();installEvt=null;install.hidden=true;}};help.appendChild(install);});
  /* A tall in-flow directory is not a bottom obstruction. */
  fitDock=function(){
    var viewport=window.visualViewport,vh=viewport?viewport.height:window.innerHeight,keyboard=viewport?Math.max(0,window.innerHeight-vh-viewport.offsetTop):0;
    var bar=$('tbar'),rect=bar&&getComputedStyle(bar).position==='fixed'?bar.getBoundingClientRect():null;
    var h=rect&&rect.height>0&&rect.bottom>0&&rect.top<window.innerHeight?Math.ceil(window.innerHeight-Math.max(0,rect.top)):0;
    var bottom=Math.min(Math.max(bar?18:66,h+10-keyboard),Math.max(12,vh-64));orb.style.bottom=(keyboard+bottom)+'px';
    var tight=window.innerWidth<=520||vh<=500,dialogBottom=expanded||tight?8:Math.min(bottom+64,Math.max(12,vh*.25));
    win.style.bottom=(keyboard+dialogBottom)+'px';win.style.height=Math.max(0,Math.min(expanded?vh:680,vh-dialogBottom-12))+'px';
    if(h){var need=h+22,cur=parseFloat(getComputedStyle(document.body).paddingBottom)||0;if(cur<need)document.body.style.paddingBottom=need+'px';}
  };
  fitDock();addEventListener('resize',fitDock);if(window.visualViewport){window.visualViewport.addEventListener('resize',fitDock);window.visualViewport.addEventListener('scroll',fitDock);}
  var bar=$('tbar');if(bar&&window.ResizeObserver)new ResizeObserver(fitDock).observe(bar);
  if(!bar){var mo=new MutationObserver(function(){var b=$('tbar');if(b){mo.disconnect();fitDock();if(window.ResizeObserver)new ResizeObserver(fitDock).observe(b);}});mo.observe(document.documentElement,{childList:true,subtree:true});}
})();
