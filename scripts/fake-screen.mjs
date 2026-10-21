// Synthetic "designer desktop" used by the marketing screenshot script.
export const screenScript = () => {
  const W = 1440;
  const H = 900;

  const draw = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas unavailable');

    let seed = 41;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const round = (x, y, w, h, r) => {
      c.beginPath();
      c.roundRect(x, y, w, h, r);
    };
    const text = (value, x, y, font, color = '#16170f') => {
      c.font = font;
      c.fillStyle = color;
      c.fillText(value, x, y);
    };

    // Desktop backdrop
    c.fillStyle = '#d7d0c2';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2400; i++) {
      c.fillStyle = `rgba(30, 28, 20, ${0.015 + rand() * 0.025})`;
      c.fillRect(rand() * W, rand() * H, 1, 1);
    }

    // Browser chrome
    c.save();
    c.shadowColor = 'rgba(20, 18, 12, 0.28)';
    c.shadowBlur = 48;
    c.shadowOffsetY = 22;
    c.fillStyle = '#f7f3e9';
    round(54, 38, 1332, 824, 18);
    c.fill();
    c.restore();

    c.save();
    round(54, 38, 1332, 824, 18);
    c.clip();
    c.fillStyle = '#f7f3e9';
    c.fillRect(54, 38, 1332, 824);

    // Top bar
    c.fillStyle = '#ebe5d8';
    c.fillRect(54, 38, 1332, 46);
    for (const [i, color] of ['#ff6b57', '#f2bd4c', '#57b880'].entries()) {
      c.beginPath();
      c.arc(82 + i * 24, 61, 6, 0, Math.PI * 2);
      c.fillStyle = color;
      c.fill();
    }
    c.fillStyle = '#f9f6ef';
    round(560, 49, 330, 24, 12);
    c.fill();
    text('atelier.studio/objects', 580, 66, '12px "Helvetica Neue", Arial', '#777264');

    // Site nav
    text('ATELIER', 102, 130, '700 16px "Helvetica Neue", Arial', '#16170f');
    c.fillStyle = '#1d3be8';
    c.beginPath();
    c.arc(188, 124, 4, 0, Math.PI * 2);
    c.fill();
    text('Work', 720, 130, '13px "Helvetica Neue", Arial', '#565347');
    text('Studio', 788, 130, '13px "Helvetica Neue", Arial', '#565347');
    text('Journal', 858, 130, '13px "Helvetica Neue", Arial', '#565347');
    text('Contact', 1186, 130, '13px "Helvetica Neue", Arial', '#16170f');
    c.strokeStyle = 'rgba(22, 23, 15, 0.14)';
    c.beginPath();
    c.moveTo(102, 158);
    c.lineTo(1338, 158);
    c.stroke();

    // Editorial headline
    text('Objects with', 102, 300, '400 104px Georgia, "Times New Roman", serif', '#16170f');
    c.save();
    c.font = 'italic 400 104px Georgia, "Times New Roman", serif';
    c.fillStyle = '#1d3be8';
    c.fillText('intent.', 102, 404);
    c.restore();

    // Intro copy
    c.fillStyle = '#575347';
    c.font = '17px/1.55 "Helvetica Neue", Arial';
    const copy = [
      'A collection of quiet objects for loud rooms.',
      'Designed in Copenhagen. Made to be handled.',
    ];
    copy.forEach((line, i) => c.fillText(line, 106, 466 + i * 27));

    // Primary link
    c.strokeStyle = '#16170f';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(106, 536);
    c.lineTo(240, 536);
    c.stroke();
    text('See the collection', 106, 566, '600 13px "Helvetica Neue", Arial', '#16170f');

    // Product image composition
    c.save();
    round(646, 196, 656, 474, 10);
    c.clip();
    const grad = c.createLinearGradient(646, 196, 1302, 670);
    grad.addColorStop(0, '#1d3be8');
    grad.addColorStop(0.48, '#6f7cff');
    grad.addColorStop(1, '#f1b6a2');
    c.fillStyle = grad;
    c.fillRect(646, 196, 656, 474);
    c.fillStyle = 'rgba(247, 243, 233, 0.86)';
    c.beginPath();
    c.arc(974, 438, 168, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#16170f';
    c.beginPath();
    c.arc(1012, 410, 86, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f1b6a2';
    c.beginPath();
    c.arc(1054, 378, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(22, 23, 15, 0.12)';
    c.fillRect(646, 196, 656, 474);
    c.restore();
    c.strokeStyle = 'rgba(22, 23, 15, 0.12)';
    c.strokeRect(646.5, 196.5, 655, 473);

    // Caption under image
    text('01', 648, 708, '500 11px "SFMono-Regular", Menlo, monospace', '#777264');
    text('Lamp No. 4, powder coated steel, 2026', 678, 708, '12px "Helvetica Neue", Arial', '#575347');
    text('Edition of 24', 1180, 708, '12px "Helvetica Neue", Arial', '#575347');

    // Bottom cards
    const cards = [
      ['Material study', 'Anodised aluminium, 4 finishes'],
      ['The archive', 'Past editions, kept in one place'],
      ['Studio notes', 'On making fewer, better things'],
    ];
    cards.forEach(([title, body], i) => {
      const x = 102 + i * 424;
      c.strokeStyle = 'rgba(22, 23, 15, 0.16)';
      c.beginPath();
      c.moveTo(x, 748);
      c.lineTo(x + 380, 748);
      c.stroke();
      text(title, x, 782, '600 15px "Helvetica Neue", Arial', '#16170f');
      c.fillStyle = '#686456';
      c.font = '13px "Helvetica Neue", Arial';
      c.fillText(body, x, 807);
    });

    // Vertical mark
    c.save();
    c.translate(1346, 330);
    c.rotate(Math.PI / 2);
    text('FORM / FUNCTION / 2026', 0, 0, '10px "SFMono-Regular", Menlo, monospace', '#777264');
    c.restore();

    // Paper grain over the whole screen
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = `rgba(30, 28, 20, ${0.012 + rand() * 0.018})`;
      c.fillRect(rand() * W, rand() * H, 1, 1);
    }

    c.restore();
    return canvas;
  };

  const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getDisplayMedia = async () => {
    void original;
    console.log('fake-display: call');
    const canvas = draw();
    const ctx = canvas.getContext('2d');
    let tick = 0;
    const timer = setInterval(() => {
      // Keep producing frames for requestVideoFrameCallback.
      ctx.fillStyle = tick % 2 ? 'rgba(247,243,233,0.12)' : 'rgba(29,59,232,0.12)';
      ctx.fillRect(tick % 1440, 2, 2, 2);
      tick += 7;
    }, 33);
    const stream = canvas.captureStream(30);
    stream.getVideoTracks()[0]?.addEventListener('ended', () => clearInterval(timer));
    return stream;
  };
};
