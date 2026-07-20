/* Ductus — Motor de Cálculo (Dutos + Carga Térmica) */

document.addEventListener('DOMContentLoaded', () => {
  // Controle de Abas
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => { p.classList.remove('is-active'); p.hidden = true; });

      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.classList.add('is-active');
      panel.hidden = false;
    });
  });

  // Módulo Dutos - Cálculo
  const ductForm = document.getElementById('duct-form');
  const frictionInput = document.getElementById('friction');
  const frictionOut = document.getElementById('friction-out');

  const ISO_DIAMETERS = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000];

  function calcDuct() {
    let flow = parseFloat(document.getElementById('flow').value) || 0;
    const unit = document.getElementById('flow-unit').value;
    const targetDp = parseFloat(frictionInput.value) || 0.8;
    const rough = parseFloat(document.getElementById('material').value) / 1000 || 0.00009; // mm to m

    frictionOut.value = targetDp.toFixed(2).replace('.', ',');

    // Converte vazão para m³/s
    if (unit === 'ls') flow /= 1000;
    if (unit === 'm3h') flow /= 3600;
    if (unit === 'cfm') flow *= 0.000471947;

    if (flow <= 0) return;

    const rho = 1.204; // kg/m³
    const nu = 1.516e-5; // m²/s

    // Diâmetro ideal por busca
    let dCalc = 0.1;
    for (let d = 0.05; d <= 2.0; d += 0.001) {
      const area = (Math.PI * d * d) / 4;
      const v = flow / area;
      const re = (v * d) / nu;
      let f = 0.02;

      // Colebrook-White iterativo
      for (let i = 0; i < 5; i++) {
        f = 1 / Math.pow(-2 * Math.log10((rough / (3.7 * d)) + (2.51 / (re * Math.sqrt(f)))), 2);
      }
      const dp = f * (1 / d) * (rho * v * v) / 2;
      if (dp <= targetDp) {
        dCalc = d;
        break;
      }
    }

    const dCalcMm = dCalc * 1000;
    const dComMm = ISO_DIAMETERS.find(d => d >= dCalcMm) || ISO_DIAMETERS[ISO_DIAMETERS.length - 1];
    const dCom = dComMm / 1000;

    const areaReal = (Math.PI * dCom * dCom) / 4;
    const vReal = flow / areaReal;
    const reReal = (vReal * dCom) / nu;
    let fReal = 0.02;
    for (let i = 0; i < 5; i++) {
      fReal = 1 / Math.pow(-2 * Math.log10((rough / (3.7 * dCom)) + (2.51 / (reReal * Math.sqrt(fReal)))), 2);
    }
    const dpReal = fReal * (1 / dCom) * (rho * vReal * vReal) / 2;
    const pvReal = (rho * vReal * vReal) / 2;

    // Atualização da UI
    document.getElementById('duct-diam').textContent = dComMm;
    document.getElementById('duct-diam-calc').textContent = dCalcMm.toFixed(1);
    document.getElementById('duct-vel').textContent = vReal.toFixed(2);
    document.getElementById('duct-dpdl').textContent = dpReal.toFixed(2) + ' Pa/m';
    document.getElementById('duct-pv').textContent = pvReal.toFixed(1) + ' Pa';
    document.getElementById('duct-re').textContent = Math.round(reReal).toLocaleString();
    document.getElementById('duct-f').textContent = fReal.toFixed(4);

    const vmax = parseFloat(document.getElementById('vmax').value) || 6;
    const badge = document.getElementById('duct-badge');
    if (vReal > vmax) {
      badge.textContent = 'Velocidade Alta';
      badge.style.background = '#ef4444';
    } else {
      badge.textContent = 'OK';
      badge.style.background = '#22c55e';
    }
  }

  // Módulo Carga Térmica - Cálculo
  const loadForm = document.getElementById('load-form');

  function calcLoad() {
    const area = parseFloat(document.getElementById('area').value) || 0;
    const tin = parseFloat(document.getElementById('tin').value) || 24;
    const tout = parseFloat(document.getElementById('tout').value) || 35;
    const envVal = document.getElementById('envelope').value;

    let envCoeff = 130;
    if (envVal === 'light') envCoeff = 90;
    if (envVal === 'heavy') envCoeff = 180;

    const qEnvelope = area * envCoeff;
    const people = parseFloat(document.getElementById('people').value) || 0;
    const actW = parseFloat(document.getElementById('people-act').value) || 150;
    const qPeople = people * actW;

    const lightDensity = parseFloat(document.getElementById('light-dens').value) || 0;
    const qLight = area * lightDensity;
    const qEquip = parseFloat(document.getElementById('equip').value) || 0;

    const oaRate = parseFloat(document.getElementById('oa-rate').value) || 7.5;
    const oaFlow = people * oaRate; // L/s
    const deltaT = Math.max(0, tout - tin);
    const qOaSens = 1.2 * oaFlow * deltaT; // W

    // Latente estimada simples
    const rhOut = parseFloat(document.getElementById('rh-out').value) || 60;
    const deltaW = 0.008 * (rhOut / 100);
    const qOaLat = 3010 * oaFlow * deltaW;

    const totalSens = qEnvelope + qPeople * 0.6 + qLight + qEquip + qOaSens;
    const totalLat = qPeople * 0.4 + qOaLat;
    const qTotal = totalSens + totalLat;

    const kW = qTotal / 1000;
    const TR = kW / 3.517;
    const wM2 = area > 0 ? qTotal / area : 0;
    const supplyFlow = totalSens / (1.2 * 10); // L/s para ΔT = 10°C

    document.getElementById('load-kw').textContent = kW.toFixed(2);
    document.getElementById('load-tr').textContent = TR.toFixed(2);
    document.getElementById('load-wm2').textContent = wM2.toFixed(0);
    document.getElementById('load-sens').textContent = (totalSens / 1000).toFixed(2) + ' kW';
    document.getElementById('load-lat').textContent = (totalLat / 1000).toFixed(2) + ' kW';
    document.getElementById('load-oa').textContent = oaFlow.toFixed(1) + ' L/s';
    document.getElementById('load-supply').textContent = supplyFlow.toFixed(0) + ' L/s';
  }

  ductForm.addEventListener('input', calcDuct);
  loadForm.addEventListener('input', calcLoad);

  // Inicializa cálculos
  calcDuct();
  calcLoad();
});
