import "@fontsource-variable/archivo";
import "@fontsource-variable/archivo/wght-italic.css";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "./landing.css";
import { h } from "../lib/dom";
import { createAuthUI } from "./auth";
import { icon } from "./icons";
import { localAuth } from "../auth/session";
import { AUTHOR_URL, REPO_URL } from "./links";

import areaShot from "./assets/area-select.webp";
import editorShot from "./assets/editor.webp";
import quickAccessShot from "./assets/quick-access.webp";
import editedShot from "./assets/edited.webp";
import screenShot from "./assets/screen.webp";
import recordingShot from "./assets/recording.webp";
import studioHistoryShot from "./assets/studio-history.webp";
import videoEditorShot from "./assets/video-editor.webp";
import qrisShot from "./assets/qris.png";

const proof = [
  ["8", "capture modes"],
  ["12", "annotation tools"],
  ["0", "bytes uploaded"],
  ["100%", "local by default"],
] as const;

const marquee = [
  "Area capture",
  "Annotate",
  "Backgrounds",
  "Record",
  "Trim",
  "OCR",
  "Pin",
  "History",
];

const showcase = [
  {
    id: "annotate",
    label: "Annotate",
    image: editorShot,
    title: "The canvas is the app.",
    copy: "Twelve tools, a real color picker, undo and redo. Everything is rendered at the source resolution.",
  },
  {
    id: "access",
    label: "Quick access",
    image: quickAccessShot,
    title: "Every capture lands in a card.",
    copy: "Annotate, copy, save or pin without leaving the page. Drag the card into any app that takes a file.",
  },
  {
    id: "area",
    label: "Area select",
    image: areaShot,
    title: "Freeze, drag, magnify.",
    copy: "The size badge updates while you drag. Shift locks a square, Enter takes the whole frame.",
  },
  {
    id: "record",
    label: "Record",
    image: recordingShot,
    title: "One click, then the tab is live.",
    copy: "Mic and system audio, a webcam bubble, pause and resume. The HUD keeps the take in view.",
  },
  {
    id: "trim",
    label: "Trim",
    image: videoEditorShot,
    title: "Keep the good part.",
    copy: "Set in and out points, then export a video or a smaller GIF with its own frame rate and width.",
  },
] as const;

const faqs = [
  {
    q: "Do I need an account to use the studio?",
    a: "Yes. The landing page is public, but the studio requires a Clerk sign-in. Your captures stay in the browser; the account is only the door.",
  },
  {
    q: "Where are my captures stored?",
    a: "In IndexedDB on this device. If you sign in, the studio opens a local database scoped to that profile. Nothing is uploaded to a media server.",
  },
  {
    q: "What does Clerk store?",
    a: "Clerk manages the sign-in session. This site saves only a small profile record (name, avatar URL, email and timestamps) in localStorage. Captures never reach Clerk.",
  },
  {
    q: "Does it work in Safari or Firefox?",
    a: "Screenshots and recording work in current versions. MP4 recording, Document Picture-in-Picture and drag-out-to-save need a Chromium browser such as Chrome, Edge or Arc.",
  },
  {
    q: "How do I get the repository?",
    a: "The project is public at github.com/galliharmada/shotinclean and ISC licensed. Signing in keeps the source access shortcut on this device, next to your local profile.",
  },
] as const;

const logoMark = `
  <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="currentColor"/>
    <path d="M9 12.5V9h3.5M19.5 9H23v3.5M23 19.5V23h-3.5M12.5 23H9v-3.5" stroke="var(--paper)" stroke-width="2.3" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="2.2" fill="var(--accent)"/>
  </svg>`;

const nav = `
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="nav-sentinel" aria-hidden="true"></div>
  <header class="nav" data-nav>
    <div class="nav-inner">
      <a class="brand" href="#top" aria-label="ShotInClean home">
        ${logoMark}
        <span class="brand-name">ShotInClean</span>
        <span class="brand-year">2026</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="#features">Features</a>
        <a href="#showcase">Showcase</a>
        <a href="#privacy">Privacy</a>
        <a href="#support">Support</a>
      </nav>
      <div class="nav-actions">
        <button class="btn btn-quiet nav-signin" type="button" data-auth-open>Sign in</button>
        <a class="btn btn-primary nav-open" href="#/app">Open the studio ${icon("arrowUpRight")}</a>
        <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu" data-menu>
          <span></span><span></span>
        </button>
      </div>
    </div>
    <div class="mobile-menu" id="mobile-menu" data-mobile-menu hidden>
      <nav aria-label="Mobile">
        <a href="#features">Features</a>
        <a href="#showcase">Showcase</a>
        <a href="#privacy">Privacy</a>
        <a href="#account">Account</a>
        <a href="#support">Support</a>
      </nav>
      <div class="mobile-actions">
        <button class="btn btn-outline" type="button" data-auth-open>Sign in</button>
        <a class="btn btn-primary" href="#/app">Open the studio ${icon("arrowRight")}</a>
      </div>
    </div>
  </header>`;

const hero = `
  <section class="hero" id="top">
    <div class="hero-grid-lines" aria-hidden="true"></div>
    <div class="shell hero-inner">
      <div class="hero-copy">
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> Browser-native capture studio</p>
        <h1>Capture it.<br /><em>Keep it clean.</em></h1>
        <p class="hero-sub">Screenshots, annotations, backgrounds, recordings and OCR in one tab. Captures stay local.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#/app">Open the studio ${icon("arrowRight")}</a>
          <a class="btn btn-outline btn-lg" href="#showcase">${icon("play")} See it in action</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-media" data-tilt>
          <div class="hero-window">
            <div class="window-bar">
              <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="window-title">ShotInClean / Annotate</span>
              <span class="window-live"><i aria-hidden="true"></i> local</span>
            </div>
            <img src="${editorShot}" width="1280" height="800" alt="ShotInClean annotation editor showing a capture with an arrow, rectangle, counter and a dark background" />
          </div>
          <div class="hero-chip chip-area"><span class="chip-kbd">⌥⇧4</span><span>Area capture</span></div>
          <div class="hero-chip chip-bg"><span class="chip-dot" aria-hidden="true"></span><span>Background 64 px</span></div>
          <div class="hero-chip chip-ocr">${icon("copy")}<span>OCR copied</span></div>
          <div class="hero-stamp">${icon("shieldCheck")} No capture uploaded</div>
        </div>
      </div>
    </div>
    <aside class="side-rail" aria-label="Project links">
      <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="#support">Donasi</a>
      <span>ISC / 2026</span>
    </aside>
    <div class="hero-corner hero-corner-a" aria-hidden="true"></div>
    <div class="hero-corner hero-corner-b" aria-hidden="true"></div>
  </section>`;

const proofStrip = `
  <section class="proof" aria-label="ShotInClean at a glance">
    <div class="shell proof-grid">
      ${proof.map(([value, label]) => `<div class="proof-item"><strong>${value}</strong><span>${label}</span></div>`).join("")}
    </div>
  </section>`;

const marqueeBand = `
  <div class="marquee" aria-hidden="true">
    <div class="marquee-track">
      ${[0, 1].map(() => marquee.map((item) => `<span>${item}</span><i>✦</i>`).join("")).join("")}
    </div>
  </div>`;

const features = `
  <section class="section features" id="features">
    <div class="shell">
      <header class="section-head" data-reveal>
        <h2>One tab.<br />The whole workflow.</h2>
        <p class="section-lede">From the first crop to the final GIF. Every tool is built for the way you actually work.</p>
      </header>

      <div class="bento">
        <article class="bento-cell cell-annotate" data-reveal>
          <div class="cell-top"><span class="cell-label">Annotate</span><span class="cell-meta">12 tools</span></div>
          <h3>Mark it up without opening another app.</h3>
          <p>Arrow, rectangle, text, highlighter, counter, pixelate, blur. All on one canvas.</p>
          <div class="cell-media editor-media">
            <img src="${editorShot}" width="1280" height="800" loading="lazy" alt="The annotation toolbar with shapes, colors and a size slider over a capture" />
            <div class="mini-toolbar" aria-hidden="true">
              ${icon("cursor")}${icon("crop")}${icon("textT")}${icon("highlighter")}${icon("paintBrush")}${icon("stack")}
            </div>
          </div>
        </article>

        <article class="bento-cell cell-bg" data-reveal>
          <div class="cell-top"><span class="cell-label">Backgrounds</span><span class="cell-meta">Try it</span></div>
          <h3>Make a screenshot look intentional.</h3>
          <p>Gradient, solid or transparent. Set the padding, corners and shadow.</p>
          <div class="bg-demo" data-bg-demo>
            <div class="bg-demo-stage" data-bg-stage>
              <div class="bg-demo-frame"><img src="${screenShot}" width="1440" height="900" loading="lazy" alt="A raw capture inside the background tool preview" /></div>
            </div>
            <div class="bg-demo-controls">
              <div class="demo-swatches" role="group" aria-label="Background style">
                <button class="demo-swatch is-active" type="button" data-fill="linear-gradient(135deg, #0f2027, #2c5364)" data-name="Ink gradient" style="--swatch: linear-gradient(135deg, #0f2027, #2c5364)" aria-label="Ink gradient" aria-pressed="true"></button>
                <button class="demo-swatch" type="button" data-fill="linear-gradient(135deg, #1f3be8, #7c8cff)" data-name="Cobalt gradient" style="--swatch: linear-gradient(135deg, #1f3be8, #7c8cff)" aria-label="Cobalt gradient" aria-pressed="false"></button>
                <button class="demo-swatch" type="button" data-fill="#f1eee5" data-name="Paper" style="--swatch: #f1eee5" aria-label="Paper" aria-pressed="false"></button>
                <button class="demo-swatch" type="button" data-fill="#10110e" data-name="Ink" style="--swatch: #10110e" aria-label="Ink" aria-pressed="false"></button>
                <button class="demo-swatch demo-swatch-clear" type="button" data-fill="repeating-conic-gradient(#e7e3d7 0 25%, #f7f4ec 0 50%) 0 0 / 12px 12px" data-name="Transparent" style="--swatch: repeating-conic-gradient(#e7e3d7 0 25%, #f7f4ec 0 50%) 0 0 / 12px 12px" aria-label="Transparent" aria-pressed="false"></button>
              </div>
              <div class="demo-slider-row">
                <label for="demo-pad">Padding</label>
                <output data-demo-pad-out>42 px</output>
                <input id="demo-pad" type="range" min="8" max="72" value="42" step="2" data-demo-pad />
              </div>
              <div class="demo-toggles">
                <button class="demo-toggle is-active" type="button" data-demo-radius aria-pressed="true">Rounded</button>
                <button class="demo-toggle is-active" type="button" data-demo-shadow aria-pressed="true">Shadow</button>
              </div>
            </div>
          </div>
          <p class="demo-readout" data-demo-readout>Ink gradient · 42 px · rounded · shadow</p>
        </article>

        <article class="bento-cell cell-area" data-reveal>
          <div class="cell-top"><span class="cell-label">Area</span><span class="cell-meta">Pixel-perfect</span></div>
          <h3>Drag once. Get the exact box.</h3>
          <p>Freeze the screen, magnify the edge, read the live size.</p>
          <div class="cell-media area-media">
            <img src="${areaShot}" width="1280" height="800" loading="lazy" alt="Area selection overlay with marching ants, a live size badge and a pixel magnifier" />
            <span class="area-size">1001 × 551</span>
            <span class="area-cross" aria-hidden="true"></span>
          </div>
        </article>

        <article class="bento-cell cell-ocr" data-reveal>
          <div class="cell-top"><span class="cell-label">Text / OCR</span><span class="cell-meta">Offline</span></div>
          <h3>Take the words with you.</h3>
          <p>Select an area. The text lands on your clipboard. Tesseract runs locally.</p>
          <div class="ocr-card">
            <div class="ocr-paper">
              <span class="ocr-caption">Recognized text</span>
              <p class="ocr-text">Ship this.<br />Objects with intent.<br />A collection of quiet objects.</p>
              <span class="ocr-scan" aria-hidden="true"></span>
            </div>
            <button class="ocr-copy" type="button" data-ocr-copy>
              ${icon("copy")}<span class="ocr-copy-label">Copy text</span>
            </button>
          </div>
        </article>

        <article class="bento-cell cell-pin" data-reveal>
          <div class="cell-top"><span class="cell-label">Pin</span><span class="cell-meta">Always on top</span></div>
          <h3>Pin it above your work.</h3>
          <p>Float any capture over other windows with Document Picture-in-Picture.</p>
          <div class="pin-demo" aria-hidden="true">
            <div class="pin-desktop">
              <span></span><span></span><span></span>
            </div>
            <div class="pin-window">
              <div class="pin-bar"><i></i><span>Pinned</span><b>×</b></div>
              <img src="${editedShot}" width="1568" height="1028" loading="lazy" alt="" />
            </div>
          </div>
        </article>

        <article class="bento-cell cell-record" data-reveal>
          <div class="cell-top"><span class="cell-label">Record</span><span class="cell-meta">MP4 / WebM / GIF</span></div>
          <div class="record-grid">
            <div>
              <h3>Record the tab. Trim the take.</h3>
              <p>Mic and system audio, a webcam bubble, pause and resume. Stop and the clip is in history.</p>
              <div class="record-facts">
                <span>${icon("microphone")} Mic</span>
                <span>${icon("webcam")} Webcam</span>
                <span>${icon("scissors")} Trim</span>
              </div>
            </div>
            <div class="record-media">
              <img src="${recordingShot}" width="1280" height="800" loading="lazy" alt="Recording HUD with timer, pause, stop and discard controls above the studio" />
              <div class="record-hud" aria-hidden="true"><i></i><span>0:12</span><b>Stop</b></div>
            </div>
          </div>
        </article>

        <article class="bento-cell cell-history" data-reveal>
          <div class="cell-top"><span class="cell-label">History</span><span class="cell-meta">IndexedDB</span></div>
          <div class="history-grid-cell">
            <div>
              <h3>Every capture, still here.</h3>
              <p>Kept on this device and scoped to your local profile. Open history, pick up where you left off.</p>
              <div class="history-formats">
                <span>${icon("image")} Image</span>
                <span>${icon("videoCamera")} Video</span>
                <span>${icon("sparkle")} GIF</span>
              </div>
            </div>
            <div class="history-media">
              <img src="${studioHistoryShot}" width="1280" height="800" loading="lazy" alt="Studio history with captured images and videos" />
              <div class="history-chip"><span>${icon("hardDrives")} local only</span></div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>`;

const showcaseSection = `
  <section class="section showcase" id="showcase">
    <div class="shell">
      <header class="section-head showcase-head" data-reveal>
        <h2 class="display-serif">Know your capture.</h2>
        <p class="section-lede">Five frames from the studio. Captured from the app, not mocked up.</p>
      </header>
      <div class="stage" data-reveal>
        <div class="stage-stars" aria-hidden="true"></div>
        <div class="stage-top">
          <div class="tabs" role="tablist" aria-label="Studio views">
            ${showcase
              .map(
                (item, index) => `
                <button class="tab${index === 0 ? " is-active" : ""}" type="button" role="tab" id="tab-${item.id}" aria-selected="${index === 0}" aria-controls="panel-${item.id}" tabindex="${index === 0 ? "0" : "-1"}" data-tab="${item.id}">
                  <span>0${index + 1}</span>${item.label}
                </button>`,
              )
              .join("")}
          </div>
          <span class="stage-hint">${icon("arrowRight")} Arrow keys</span>
        </div>
        <div class="stage-panels">
          ${showcase
            .map(
              (item, index) => `
              <figure class="stage-panel${index === 0 ? " is-active" : ""}" id="panel-${item.id}" role="tabpanel" aria-labelledby="tab-${item.id}" data-panel="${item.id}" ${index === 0 ? "" : "hidden"}>
                <div class="stage-image"><img src="${item.image}" width="1280" height="800" loading="${index === 0 ? "eager" : "lazy"}" alt="${item.label} in ShotInClean" /></div>
                <figcaption>
                  <span class="stage-index">0${index + 1} / 05</span>
                  <div>
                    <h3>${item.title}</h3>
                    <p>${item.copy}</p>
                  </div>
                </figcaption>
              </figure>`,
            )
            .join("")}
        </div>
      </div>
    </div>
  </section>`;

const how = `
  <section class="section how" id="how">
    <div class="shell how-grid">
      <header class="how-head" data-reveal>
        <h2>Three moves.<br />One clean file.</h2>
        <p>No export dialog maze. Capture, perfect, keep. The whole loop is one tab deep.</p>
      </header>
      <ol class="steps">
        <li class="step" data-reveal>
          <span class="step-num">01</span>
          <div class="step-copy">
            <h3>Capture</h3>
            <p>Pick an area, screen, window or your last selection. Add a timer when you need a clean frame.</p>
          </div>
          <div class="step-visual keys" aria-hidden="true">
            <span><kbd>⌥⇧4</kbd> Area</span>
            <span><kbd>⌥⇧3</kbd> Screen</span>
            <span><kbd>⌥⇧5</kbd> Window</span>
            <span><kbd>⌥⇧6</kbd> Previous</span>
          </div>
        </li>
        <li class="step" data-reveal>
          <span class="step-num">02</span>
          <div class="step-copy">
            <h3>Perfect</h3>
            <p>Annotate, redact, add a background. Crop, pad and give it a shadow without a second app.</p>
          </div>
          <div class="step-visual tools-mini" aria-hidden="true">
            ${icon("crop")}${icon("paintBrush")}${icon("highlighter")}${icon("magicWand")}${icon("textT")}${icon("scissors")}
          </div>
        </li>
        <li class="step" data-reveal>
          <span class="step-num">03</span>
          <div class="step-copy">
            <h3>Keep</h3>
            <p>Copy, save, pin or drag it into any app. The original stays in local history, ready to reopen.</p>
          </div>
          <div class="step-visual file-pill" aria-hidden="true">
            ${icon("download")}<span>shotinclean.png</span><b>PNG</b>
          </div>
        </li>
      </ol>
    </div>
  </section>`;

const privacy = `
  <section class="section privacy" id="privacy">
    <div class="shell privacy-grid">
      <div class="privacy-copy" data-reveal>
        <p class="eyebrow">Local by default</p>
        <h2>Your screen<br />is not our business.</h2>
        <p class="privacy-quote">No capture leaves this tab.</p>
        <p class="privacy-lede">Captures are stored in IndexedDB on this device. The landing page stores one thing: your local profile. There is no media server to upload to.</p>
        <ul class="check-list">
          <li>${icon("check")} Captures stay in this browser's IndexedDB.</li>
          <li>${icon("check")} The site keeps a local profile and nothing else.</li>
          <li>${icon("check")} No analytics, no media server, no upload queue.</li>
          <li>${icon("check")} Clerk handles sign-in. Captures never reach Clerk.</li>
        </ul>
      </div>
      <div class="data-map" data-reveal>
        <div class="data-card device-card">
          <div class="data-card-head">${icon("browser")} This browser <span>device</span></div>
          <div class="data-row"><span class="data-icon">${icon("signIn")}</span><div><strong>Clerk session</strong><small>managed by Clerk</small></div><b>auth</b></div>
          <div class="data-row"><span class="data-icon">${icon("user")}</span><div><strong>Local profile</strong><small>localStorage</small></div><b>small</b></div>
          <div class="data-row"><span class="data-icon">${icon("image")}</span><div><strong>Captures</strong><small>IndexedDB</small></div><b>media</b></div>
          <div class="data-row"><span class="data-icon">${icon("hardDrives")}</span><div><strong>Settings</strong><small>localStorage</small></div><b>prefs</b></div>
        </div>
        <div class="data-link" aria-hidden="true"><span></span>${icon("arrowRight")}<span></span></div>
        <div class="data-card no-cloud-card">
          <div class="no-cloud-icon">${icon("cloudSlash")}</div>
          <div><strong>No media uploads</strong><small>There is no server to send them to.</small></div>
        </div>
        <p class="data-note">${icon("info")} The studio reads the profile id to scope its local database. That is the whole handshake.</p>
      </div>
    </div>
  </section>`;

const account = `
  <section class="section account" id="account">
    <div class="shell">
      <header class="section-head account-head" data-reveal>
        <h2>A profile,<br />not a pipeline.</h2>
        <p class="section-lede">Sign in with Clerk to open the studio. Your profile stays on this device; captures stay local.</p>
      </header>
      <div class="account-grid">
        <div class="auth-card" data-reveal>
          <div class="auth-card-head">
            <span class="auth-mark">${logoMark}</span>
            <div>
              <span class="auth-card-title">Your account</span>
              <span class="auth-card-sub">Clerk auth · local record</span>
            </div>
            <span class="auth-status" data-auth-status>Required</span>
          </div>
          <div class="auth-body" data-auth-body></div>
        </div>

        <div class="local-card" data-reveal>
          <div class="local-head">
            <span class="cell-label">${icon("hardDrives")} On this device</span>
            <span class="local-badge">localStorage</span>
          </div>
          <dl class="local-rows">
            <div><dt>Profile</dt><dd data-local-profile>None</dd></div>
            <div><dt>Provider</dt><dd data-local-provider>Required</dd></div>
            <div><dt>Captures</dt><dd>IndexedDB</dd></div>
            <div><dt>Settings</dt><dd>localStorage</dd></div>
            <div><dt>Repository</dt><dd data-local-repo>Locked</dd></div>
          </dl>
          <div class="local-code">
            <div class="local-code-head"><span>shotinclean.auth.v1</span><span class="local-code-dot"></span></div>
            <pre data-auth-json>No profile saved on this device.</pre>
          </div>
          <button class="local-forget" type="button" data-auth-action="forget-stored" hidden>Forget saved profile</button>
        </div>
      </div>

      <div class="repo-card" data-reveal>
        <div class="repo-mark">${icon("github")}</div>
        <div class="repo-copy">
          <span class="cell-label">Source access</span>
          <h3>The whole studio is open source.</h3>
          <p>ISC licensed, TypeScript and Vite. The repository shortcut unlocks with your local profile.</p>
        </div>
        <div class="repo-action" data-repo-action>
          <span class="repo-lock">${icon("lock")} Sign in to unlock</span>
        </div>
      </div>
    </div>
  </section>`;

const support = `
  <section class="section support" id="support">
    <div class="shell support-grid">
      <div class="support-copy" data-reveal>
        <p class="eyebrow">Support the studio</p>
        <h2>Keep the shutter free.</h2>
        <p>ShotInClean is built and maintained by one person. No subscription, no ads, no upload bill. If it saves you a minute, you can support it with a QRIS donation.</p>
        <div class="support-why">
          <p class="support-why-label">Why donations matter</p>
          <ul>
            <li><strong>Server and hosting.</strong> Domain, CDN, backups and uptime monitoring.</li>
            <li><strong>Improvements.</strong> Browser fixes, accessibility and new capture tools.</li>
            <li><strong>Independence.</strong> No ads, no paywall, no data selling.</li>
          </ul>
          <p class="support-why-note">Captures stay on your device. Donations only support the public site and development.</p>
        </div>
        <div class="support-actions">
          <button class="btn btn-primary support-donate" type="button" data-donate-open>${icon("heart")} Donasi</button>
          <span class="support-direct">${icon("checkCircle")} QRIS · GoPay, BCA, Mandiri, BNI, BRI</span>
        </div>
        <p class="fineprint">${icon("shieldCheck")} The QR opens in a modal. Payment data never touches this site.</p>
      </div>
      <aside class="support-card" data-reveal>
        <div class="support-card-top">
          <span class="support-mark">${icon("heart")}</span>
          <span class="cell-meta">QRIS · Indonesia</span>
        </div>
        <span class="support-watermark" aria-hidden="true">${icon("heart")}</span>
        <p class="support-quote">"A small fund for a tool with no upload bill."</p>
        <div class="support-facts">
          <div><span>${icon("checkCircle")}</span><strong>No account needed</strong><small>Donate without signing in.</small></div>
          <div><span>${icon("shieldCheck")}</span><strong>No data shared</strong><small>No capture, no email, no tracking.</small></div>
          <div><span>${icon("sparkle")}</span><strong>Keeps it independent</strong><small>Built and maintained by one person.</small></div>
        </div>
      </aside>
    </div>
  </section>`;

const faq = `
  <section class="section faq" id="faq">
    <div class="shell faq-grid">
      <header class="faq-head" data-reveal>
        <h2>Questions,<br />answered.</h2>
        <p>Still curious? <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">Read the source ${icon("arrowUpRight")}</a>.</p>
      </header>
      <div class="faq-list" data-reveal>
        ${faqs
          .map(
            (item, index) => `
          <details class="faq-item"${index === 0 ? " open" : ""}>
            <summary><span>${item.q}</span><i aria-hidden="true"></i></summary>
            <p>${item.a}</p>
          </details>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;

const final = `
  <section class="final">
    <div class="final-grid-lines" aria-hidden="true"></div>
    <div class="shell final-inner" data-reveal>
      <h2>Your next screenshot<br />deserves better.</h2>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="#/app">Open the studio ${icon("arrowRight")}</a>
        <a class="btn btn-outline btn-lg" href="#support">Support the project</a>
      </div>
      <p class="final-note">Clerk sign-in required. No upload. No install.</p>
    </div>
  </section>`;

const footer = `
  <footer class="footer">
    <div class="shell footer-top">
      <div class="footer-brand">
        <a class="brand" href="#top" aria-label="ShotInClean home">${logoMark}<span class="brand-name">ShotInClean</span></a>
        <p>A browser-native capture studio.<br />Your screen stays yours.</p>
        <a class="footer-repo" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${icon("github")} github.com/galliharmada/shotinclean</a>
      </div>
      <div class="footer-cols">
        <div>
          <h3>Product</h3>
          <a href="#features">Features</a>
          <a href="#showcase">Showcase</a>
          <a href="#privacy">Privacy</a>
          <a href="#support">Support</a>
        </div>
        <div>
          <h3>Studio</h3>
          <a href="#/app">Open the studio</a>
          <a href="#account">Account</a>
          <a href="#faq">FAQ</a>
          <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">Repository</a>
        </div>
        <div>
          <h3>Elsewhere</h3>
          <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="#support">Donasi</a>
        </div>
      </div>
    </div>
    <div class="shell footer-bottom">
      <span>ISC licensed. TypeScript and Vite. No trackers.</span>
      <span>Made by <a href="${AUTHOR_URL}" target="_blank" rel="noopener noreferrer">Gallih Armada</a>.</span>
      <a href="#top">Back to top ↑</a>
    </div>
  </footer>`;

function toast(message: string, tone: "info" | "error" = "info"): void {
  const region = document.querySelector<HTMLElement>("[data-toast-region]");
  if (!region) return;
  const el = h(
    "div",
    {
      class: `toast${tone === "error" ? " toast-error" : ""}`,
      role: tone === "error" ? "alert" : "status",
    },
    message,
  );
  region.append(el);
  window.setTimeout(() => {
    el.classList.add("is-leaving");
    window.setTimeout(() => el.remove(), 300);
  }, 3200);
}

function initNav(root: HTMLElement): void {
  const nav = root.querySelector<HTMLElement>("[data-nav]");
  const sentinel = root.querySelector<HTMLElement>(".nav-sentinel");
  if (nav && sentinel && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => nav.classList.toggle("is-stuck", !entry.isIntersecting),
      {
        rootMargin: "-1px 0px 0px 0px",
      },
    );
    observer.observe(sentinel);
  }

  const button = root.querySelector<HTMLButtonElement>("[data-menu]");
  const menu = root.querySelector<HTMLElement>("[data-mobile-menu]");
  if (!button || !menu) return;

  const setOpen = (open: boolean) => {
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("is-open"));
    } else {
      menu.classList.remove("is-open");
      window.setTimeout(() => {
        if (button.getAttribute("aria-expanded") === "false")
          menu.hidden = true;
      }, 220);
    }
  };

  button.addEventListener("click", () =>
    setOpen(button.getAttribute("aria-expanded") !== "true"),
  );
  menu.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a, button")) setOpen(false);
  });
  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      button.getAttribute("aria-expanded") === "true"
    ) {
      setOpen(false);
      button.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (innerWidth > 900) setOpen(false);
  });
}

function initReveal(root: HTMLElement): void {
  const items = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  items.forEach((item) => observer.observe(item));
}

function initTabs(root: HTMLElement): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-panel]")];
  if (tabs.length === 0) return;

  const select = (id: string, focus = false) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach((panel) => {
      const active = panel.dataset.panel === id;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab.dataset.tab!));
    tab.addEventListener("keydown", (event) => {
      if (
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft" &&
        event.key !== "Home" &&
        event.key !== "End"
      )
        return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      select(tabs[next].dataset.tab!, true);
    });
  });
}

function initBackgroundDemo(root: HTMLElement): void {
  const demo = root.querySelector<HTMLElement>("[data-bg-demo]");
  if (!demo) return;
  const stage = demo.querySelector<HTMLElement>("[data-bg-stage]");
  const slider = demo.querySelector<HTMLInputElement>("[data-demo-pad]");
  const out = demo.querySelector<HTMLElement>("[data-demo-pad-out]");
  const readout = root.querySelector<HTMLElement>("[data-demo-readout]");
  const radius = demo.querySelector<HTMLButtonElement>("[data-demo-radius]");
  const shadow = demo.querySelector<HTMLButtonElement>("[data-demo-shadow]");
  const swatches = [...demo.querySelectorAll<HTMLButtonElement>("[data-fill]")];

  let fill = "Ink gradient";
  let padding = 42;
  let rounded = true;
  let hasShadow = true;

  const render = () => {
    if (!stage) return;
    stage.style.setProperty("--demo-pad", `${padding}px`);
    stage.style.setProperty("--demo-radius", rounded ? "18px" : "0px");
    stage.style.setProperty(
      "--demo-shadow",
      hasShadow ? "0 26px 50px rgba(16, 17, 14, 0.28)" : "none",
    );
    if (out) out.textContent = `${padding} px`;
    radius?.classList.toggle("is-active", rounded);
    radius?.setAttribute("aria-pressed", String(rounded));
    shadow?.classList.toggle("is-active", hasShadow);
    shadow?.setAttribute("aria-pressed", String(hasShadow));
    if (readout)
      readout.textContent = `${fill} · ${padding} px · ${rounded ? "rounded" : "square"} · ${hasShadow ? "shadow" : "flat"}`;
  };

  swatches.forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const value = swatch.dataset.fill ?? "";
      const name = swatch.dataset.name ?? "Custom";
      if (stage) stage.style.background = value;
      fill = name;
      swatches.forEach((item) => {
        const active = item === swatch;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });

  slider?.addEventListener("input", () => {
    padding = Number(slider.value);
    render();
  });
  radius?.addEventListener("click", () => {
    rounded = !rounded;
    render();
  });
  shadow?.addEventListener("click", () => {
    hasShadow = !hasShadow;
    render();
  });
  render();
}

function initOcr(root: HTMLElement): void {
  const button = root.querySelector<HTMLButtonElement>("[data-ocr-copy]");
  if (!button) return;
  const label = button.querySelector<HTMLElement>(".ocr-copy-label");
  const text =
    "Ship this.\nObjects with intent.\nA collection of quiet objects.";
  let timer = 0;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (label) label.textContent = "Copied";
      button.classList.add("is-copied");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (label) label.textContent = "Copy text";
        button.classList.remove("is-copied");
      }, 1800);
      toast("Recognized text copied to the clipboard.");
    } catch {
      toast("Clipboard unavailable. Select the text manually.", "error");
    }
  });
}

function initTilt(root: HTMLElement): void {
  const media = root.querySelector<HTMLElement>("[data-tilt]");
  if (!media) return;
  if (
    !matchMedia("(pointer: fine)").matches ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;

  let raf = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const animate = () => {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    media.style.setProperty("--tilt-x", `${currentX.toFixed(3)}deg`);
    media.style.setProperty("--tilt-y", `${currentY.toFixed(3)}deg`);
    if (
      Math.abs(targetX - currentX) > 0.01 ||
      Math.abs(targetY - currentY) > 0.01
    ) {
      raf = requestAnimationFrame(animate);
    } else {
      raf = 0;
    }
  };

  const kick = () => {
    if (!raf) raf = requestAnimationFrame(animate);
  };

  media.addEventListener("pointermove", (event) => {
    const rect = media.getBoundingClientRect();
    targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 5;
    targetX = ((event.clientY - rect.top) / rect.height - 0.5) * -4;
    kick();
  });
  media.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
    kick();
  });
}

function initDonation(root: HTMLElement): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-donate-modal]");
  if (!dialog) return;

  const close = () => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("modal-open");
  };

  const open = () => {
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("modal-open");
  };

  root.querySelectorAll<HTMLElement>("[data-donate-open]").forEach((button) => {
    button.addEventListener("click", open);
  });
  dialog
    .querySelector<HTMLElement>("[data-donate-close]")
    ?.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", () =>
    document.body.classList.remove("modal-open"),
  );
}

function initStudioGate(
  root: HTMLElement,
  auth: ReturnType<typeof createAuthUI>,
  onStudioIntent: () => void,
): void {
  root.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      'a[href="#/app"]',
    );
    if (!link) return;
    if (localAuth.active()?.provider === "clerk") return;
    event.preventDefault();
    onStudioIntent();
    toast("Sign in with Clerk to open the studio.");
    auth.open();
  });
}

function scrollToHash(): void {
  const raw = location.hash;
  if (!raw || raw === "#/app" || raw === "#") return;
  const id = raw.startsWith("#/") ? `#${raw.slice(2)}` : raw;
  if (id === "#") return;
  const target = document.querySelector<HTMLElement>(
    id.startsWith("#") ? id : `#${id}`,
  );
  if (!target) return;
  requestAnimationFrame(() =>
    target.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}

export function bootLanding(root: HTMLElement): void {
  document.documentElement.classList.add("lp-ready");
  root.innerHTML = `
    <div class="lp">
      ${nav}
      <main id="main">
        ${hero}
        ${proofStrip}
        ${marqueeBand}
        ${features}
        ${showcaseSection}
        ${how}
        ${privacy}
        ${account}
        ${support}
        ${faq}
        ${final}
      </main>
      ${footer}
      <dialog class="donate-dialog" data-donate-modal aria-labelledby="donate-title">
        <div class="donate-head">
          <div>
            <span class="donate-kicker">QRIS · Indonesia</span>
            <h2 id="donate-title">Donasi</h2>
          </div>
          <button class="donate-close" type="button" data-donate-close aria-label="Close donation dialog">${icon("x")}</button>
        </div>
        <div class="donate-body">
          <h2 class="donate-name">Gallih Armada</h2>
          <div class="donate-qr"><img src="${qrisShot}" width="714" height="714" loading="lazy" alt="QRIS donation QR code for Gallih Armada" /></div>
          <p class="donate-copy">Scan with any QRIS-enabled app.</p>
          <p class="donate-apps">GoPay · BCA · Mandiri · BNI · BRI · and other banks</p>
          <p></p>
        </div>
      </dialog>
      <div class="toast-region" data-toast-region aria-live="polite" aria-atomic="false"></div>
    </div>`;

  initNav(root);
  initReveal(root);
  initTabs(root);
  initBackgroundDemo(root);
  initOcr(root);
  initTilt(root);
  initDonation(root);

  let openStudioAfterSignIn = false;
  try {
    openStudioAfterSignIn =
      sessionStorage.getItem("shotinclean.studioGate") === "1";
    if (openStudioAfterSignIn)
      sessionStorage.removeItem("shotinclean.studioGate");
  } catch {
    openStudioAfterSignIn = false;
  }

  const auth = createAuthUI({
    root,
    toast,
    onSignIn: () => {
      if (!openStudioAfterSignIn) return;
      openStudioAfterSignIn = false;
      toast("Signed in. Opening the studio...");
      window.setTimeout(() => {
        location.hash = "#/app";
      }, 600);
    },
  });
  initStudioGate(root, auth, () => {
    openStudioAfterSignIn = true;
  });
  if (openStudioAfterSignIn) {
    toast("Sign in with Clerk to open the studio.");
    window.setTimeout(() => auth.open(), 400);
  }
  scrollToHash();

  const yearTargets = root.querySelectorAll<HTMLElement>("[data-year]");
  yearTargets.forEach(
    (target) => (target.textContent = String(new Date().getFullYear())),
  );
}
