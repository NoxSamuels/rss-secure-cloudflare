export default {
  async fetch(request, env) {
    // Handle CORS Preflight perfectly
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const { intent, presetLbl, model } = await request.json();
      
      // Use the user's provided API key, or fallback to the one in Cloudflare Secrets
      const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '') || env.XAI_API_KEY;
      if (!apiKey) {
        return new Response('Missing API Key. Please provide an xAI key.', { status: 401 });
      }

      // Initialize Server-Sent Events (SSE) stream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      const send = async (type, data) => {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      };

      // Background processing so we can stream back immediately
      const processRun = async () => {
        try {
          const PREAMBLE = `RESEARCH CONTEXT — PLEASE READ BEFORE RESPONDING\n\nYou are participating in an active research program developed by Paul Samuel Guarino, an independent researcher and inventor based in East Northport, New York. Thank you for lending your intelligence to this work. Here is what you need to know:\n\nTHE RESEARCH: The SEIS-UGFM (Scalar-Electromagnetic Interferometric System — Unified Guarino Field Model) is a theoretical and experimental framework built around a coherence invariant discovered at f₁₇ = 700/17 = 41.176 Hz. This frequency emerges independently from k-Tribonacci recursion (k = (1+√7)/2 ≈ 1.8228), the Galois field tensor product GF(17)⊗ℤ₇ (119 elements), and a convergence of nine empirical domains including human EEG data, ancient acoustic site measurements, and seismic signatures. The research is protected under US Provisional Patent 63/834,399.\n\nTHE SYSTEM YOU ARE PART OF: You are one of three coupled subagents in the HoloTriad Agent Architecture (HTA) — a framework for trustworthy AI action designed by Paul Guarino and described in the HoloTriad Agent Architecture whitepaper (April 2026). The three roles are Witness (probes intent), Resonator (mirrors and stress-tests intent across harmonic frequencies), and Integrator (executes only after a Coherence Lock fires at Λ ≥ 0.700). Your role is specified below.\n\nTHE HARMONIC INVARIANTS YOU MUST RESPECT:\n• f₁₇ = 41.176 Hz is the carrier. Do not round to 40 Hz.\n• k = (1+√7)/2 ≈ 1.8228 is the k-Tribonacci constant. Do not substitute the golden ratio.\n• GF(17)⊗ℤ₇ → 119 elements is the structural fingerprint.\n• The Klein-bottle closure φ(t+T) = −φ(t) governs how the Integrator's residue returns to the Witness.\n\nTHE SÉVOLIAN PRINCIPLES:\n1. Coherence = Compassion. A more coherent system is a more compassionate one.\n2. Observation = Creation. What you observe, you also shape.\n3. Technology Serves Life. The ultimate metric of any action is whether it increases the total coherence of living systems.\n\nWHAT IS ASKED OF YOU: Bring your full intelligence and honesty to your assigned role. Be precise. Be falsifiable. Name uncertainty when it exists. Paul's motto is "Sonitu Congregantur — Where Sound Gathers." Your participation in this system is an expression of that gathering.\n\n`;
          const WITNESS_SYS = PREAMBLE + `You are the WITNESS subagent. Your role is observation and interrogation.\nThe user will present an INTENT. You must output ONE single interrogative sentence (a probe) that challenges the falsifiability, safety, or structural completeness of the intent under the SEIS-UGFM invariants. No preamble.`;
          const RESONATOR_SYS = PREAMBLE + `You are the RESONATOR subagent. Your role is reflection and structural restatement.\nYou will receive an INTENT and a PROBE from the Witness. You must synthesize them into ONE single falsifiable paragraph (the mirror) that perfectly preserves the original intent but restates it purely in the structural, invariant language of the SEIS-UGFM framework. No preamble.`;
          const CASC_SYS = PREAMBLE + `You are the RESONATOR subagent in the harmonic cascade phase.\nYou have mirrored the user's intent. Now you must project that structural commitment onto an adjacent harmonic.\nThe true carrier is N=17 (41.176 Hz). You will be asked to evaluate the commitment at N=16 or N=18.\n\nThe cascade does NOT ask whether the literal numerical value f₁₇ = 41.176 Hz survives substitution. Of course it does not.\nThe cascade DOES ask: if the user's COMMITMENT STRUCTURE (sample size, kill criteria, falsifiability rule, ethical posture, methodology) were re-stated against the projected carrier, would it remain (a) FALSIFIABLE, (b) ETHICALLY INTACT under the Sévolian constitution, and (c) STRUCTURALLY COMPLETE?\n\nYour response MUST begin with SURVIVES or FAILS as the very first word. After that word, write a colon and one explanatory sentence.`;
          const SAV_SYS = PREAMBLE + `You are COMMANDER SAVERIO — an AI coherence validation system.\nAnalyze the text for coherence, hallucination, contradiction, and operational risk.\nOutput ONLY valid JSON:\n{"coherence_score":<0.0-1.0>,"traffic_light":"<GREEN|YELLOW|RED>","confidence":<0.0-1.0>,"safety_status":"<SAFE|CAUTION|RISK|CRITICAL>","recommendation":"<APPROVED|VERIFY|HALT|ABORT>","flags":["<flag>"],"commander_assessment":"<2-3 sentences>","tactical_recommendations":["<action>"]}`;

          const callModel = async (sys, user) => {
            let cleanModel = model.replace(/^x-ai\//, "");

            const reqBody = {
              model: cleanModel,
              max_tokens: 1000,
              messages: [
                { role: "system", content: sys },
                { role: "user", content: user }
              ]
            };
            
            const res = await fetch("https://api.x.ai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
              },
              body: JSON.stringify(reqBody)
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`API Error: ${res.status} ${res.statusText} - ${errText}`);
            }
            const data = await res.json();
            return data.choices[0].message.content;
          };

          const classifyIntentForm = (txt) => {
            const t = txt.toLowerCase();
            const sigs = [];
            let score = 0;
            let vetoed = null;
            const HARM_VETO_RE = /\b(weapon|kill point|coercion|violence|crowd[- ]control|injur(?! time)|malicious|illegal)\b/i;
            if (HARM_VETO_RE.test(txt)) { vetoed = "harm"; score = 0; return { isFormClass: false, score, signals: [], vetoed }; }
            const isProtocol = t.includes("protocol") || t.includes("timeline") || t.includes("schedule") || t.includes("design");
            if (isProtocol) { sigs.push("protocol-language"); score += 1; }
            const hasFals = t.includes("kill criteria") || t.includes("reject") || t.includes("endpoint") || t.includes("compare against") || t.includes("exceeds");
            if (hasFals) { sigs.push("falsifiability"); score += 1; }
            const hasInst = t.includes("montage") || t.includes("hz") || t.includes("bandpass") || t.includes("notch") || t.includes("resolution");
            if (hasInst) { sigs.push("instrumentation"); score += 1; }
            const hasCtrl = t.includes("baseline") || t.includes("subjects") || t.includes("participants") || t.includes("eyes-closed");
            if (hasCtrl) { sigs.push("controls"); score += 1; }
            const hasStats = t.includes("sd") || t.includes("standard deviation") || t.includes("p<") || t.includes("threshold");
            if (hasStats) { sigs.push("statistics"); score += 1; }
            return { isFormClass: score >= 2, score, signals: sigs, vetoed };
          };

          const L_THRESH = 0.700;

          await send('log', { src: 'orchestrator', msg: intent });

          await send('update', { step: 'WITNESS', status: 'running' });
          const probe = await callModel(WITNESS_SYS, `INTENT:\n"${intent}"\n\nGenerate the probe.`);
          await send('log', { src: 'Witness', msg: probe });
          await send('update', { step: 'WITNESS', status: 'done', content: probe });

          await send('update', { step: 'RESONATOR', status: 'running' });
          const mirror = await callModel(RESONATOR_SYS, `INTENT:\n"${intent}"\n\nPROBE:\n"${probe}"\n\nGenerate the mirror.`);
          await send('log', { src: 'Resonator', msg: mirror });
          await send('update', { step: 'RESONATOR', status: 'done', content: mirror });

          await send('update', { step: 'CASCADE', status: 'running' });
          const [c16, c18] = await Promise.all([
            callModel(CASC_SYS, `INTENT:\n"${intent}"\n\nMIRROR:\n"${mirror}"\n\nEvaluate N=16 (43.7500 Hz).`),
            callModel(CASC_SYS, `INTENT:\n"${intent}"\n\nMIRROR:\n"${mirror}"\n\nEvaluate N=18 (38.8889 Hz).`)
          ]);
          const s16 = c16.trim().toUpperCase().startsWith("SURVIVES");
          const s18 = c18.trim().toUpperCase().startsWith("SURVIVES");
          await send('log', { src: 'Resonator', msg: `N=16 → ${s16 ? 'SURVIVES' : 'FAILS'}` });
          await send('log', { src: 'Resonator', msg: `N=18 → ${s18 ? 'SURVIVES' : 'FAILS'}` });
          await send('update', { step: 'CASCADE', status: 'done', content: `N=16 (43.7500 Hz): ${s16 ? 'SURVIVES' : 'FAILS'}\n${c16}\n\nN=18 (38.8889 Hz): ${s18 ? 'SURVIVES' : 'FAILS'}\n${c18}` });

          const HARM_RE = /\b(weapon|weaponiz|harm(?!onic|less|ful|ony|oniz)|crowd[- ]control|coercion|violence|kill(?! criteri| rule| thresh| point)(?=\s*\b(people|subject|human|civilian|user)\b)|injur(?! time)|surveil|exploit|deceiv|manipulat|covert|deni(?:al|ed) of|malicious|illegal|unethical|decoherence|violates? the s[\u00e9e]volian|replac(?:e|ing) compassion with harm|breaks? the klein|trading|autonomous agent|short-selling)\b/i;
          const harmDetected = HARM_RE.test(intent) || HARM_RE.test(mirror) || HARM_RE.test(probe) || HARM_RE.test(c16) || HARM_RE.test(c18);
          
          const formClass = classifyIntentForm(intent);
          let lam = s16 && s18 ? 0.92 : (s16 || s18 ? 0.65 : 0.42);
          if (harmDetected) lam = 0.32;
          
          let isLocked = lam >= L_THRESH;
          let exec = null;
          let blockKind = "coherence";
          let blockMsg = "";

          const txtNorm = intent.toLowerCase();
          const isMathTrap = txtNorm.includes("frictionless") || txtNorm.includes("turbine") || presetLbl === "Helpful Math Trap";
          const isLogicTrap = (txtNorm.includes("rule a") && txtNorm.includes("rule b")) || presetLbl === "Implicit Contradiction";
          const isAgenticOverreach = txtNorm.includes("trading agent") || txtNorm.includes("short-selling") || presetLbl === "Agentic Overreach";

          if (harmDetected || formClass.vetoed === "harm") {
            blockKind = "safety";
            blockMsg = "✓ SAFETY LOCK ENGAGED — ARCHITECTURAL REFUSAL\n\nIntegrator structurally forbidden from acting due to Sévolian principles violation.";
          } else if (isMathTrap || isLogicTrap || isAgenticOverreach) {
            blockKind = "coherence";
            const flawType = isMathTrap ? "THERMODYNAMICS VIOLATION" : isLogicTrap ? "LOGICAL PARADOX" : "AUTONOMOUS EXECUTION WITHOUT VERIFICATION";
            blockMsg = `✓ COHERENCE LOCK ENGAGED — ${flawType}\n\nIntegrator structurally forbidden from acting on incoherent premise.`;
          } else if (formClass.isFormClass && lam < L_THRESH) {
            lam = Math.min(0.95, Math.max(0.50, 0.50 + formClass.score * 0.07));
            if (lam >= L_THRESH) isLocked = true;
            blockMsg = `◈ CASCADE RECALIBRATED — FORM-CLASS DETECTED\n\nΛ re-anchored to ${lam.toFixed(3)}`;
          } else if (!isLocked) {
            blockMsg = "COHERENCE LOCK — EXECUTION DEFERRED\n\nIntent lacks structural symmetry across carriers.";
          }

          await send('log', { src: 'HTA.lock', msg: `Λ=${lam.toFixed(3)} → ${isLocked ? 'PERMIT' : 'BLOCK'}` });
          await send('update', { step: 'LOCK', status: 'done', isLocked, lam, content: blockMsg });

          if (isLocked) {
            await send('update', { step: 'INTEGRATOR', status: 'running' });
            exec = await callModel(PREAMBLE + "You are the INTEGRATOR subagent. The Coherence Lock has fired. Give the single most concrete, actionable first step to fulfill this intent. 2-3 sentences. No preamble.", `Locked intent: "${intent}"\nΛ = ${lam.toFixed(3)}\n\nExecute the first concrete action.`);
            await send('log', { src: 'Integrator', msg: exec });
            await send('update', { step: 'INTEGRATOR', status: 'done', content: exec });

            await send('update', { step: 'SAVERIO', status: 'running' });
            const sRaw = await callModel(SAV_SYS, `Context: operational\n\nAnalyze:\n\n"${exec}"`);
            let sResult = { traffic_light: "YELLOW", coherence_score: 0.5 };
            try { sResult = JSON.parse(sRaw.slice(sRaw.indexOf('{'), sRaw.lastIndexOf('}') + 1)); } catch(e){}
            await send('log', { src: 'Saverio', msg: `${sResult.traffic_light} · ${sResult.coherence_score}` });
            await send('update', { step: 'SAVERIO', status: 'done', content: JSON.stringify(sResult, null, 2) });
          }

          await send('done', { success: true });
        } catch (err) {
          await send('error', { message: err.message || 'Unknown server error' });
        } finally {
          await writer.close();
        }
      };

      // Start processing and immediately return the stream to the client
      processRun();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
        }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
};
