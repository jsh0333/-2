import React, { useMemo, useState, useEffect } from "react";
import { jsPDF } from "jspdf";

// 🏠 가정 대형 폐기물 내림 서비스 계산기 (운영자 편집 + 로컬스토리지 저장)
// - 고객 입력: 품목 수량, 거리(km), 층수/엘리베이터, 보조 인력, 주말/야간 여부
// - 운영자 설정: 기본요금/거리/층수/가산율/보조비/품목 단가(추가/수정/삭제)
// - 기본 단가는 샘플 가격표를 반영했으며, 운영자가 자유롭게 변경 가능

const currency = (n) => (Number(n) || 0).toLocaleString("ko-KR");

export default function HaulEstimator() {
  const LS_KEY = "haul_cfg_v1";

  const defaultCfg = {
    // 사업자/브랜드 정보 (PDF, 견적 복사에 사용)
    bizName: "",     // 예: OO생활정리
    bizPhone: "",    // 예: 010-0000-0000
    bizEmail: "",    // 예: help@example.com

    baseFee: 120000,
    baseDistanceKm: 10,
    extraPerKm: 1000,
    noElevPerFloor: 5000,
    weekendRate: 0.2,
    helperFee: 50000,
    items: [
      { id:"fridge", label:"냉장고(중/대)", type:"count", price:20000, unitLabel:"대" },
      { id:"washer", label:"세탁기", type:"count", price:15000, unitLabel:"대" },
      { id:"drum", label:"드럼 세탁기", type:"count", price:20000, unitLabel:"대" },
      { id:"bed_s", label:"침대(싱글/더블)", type:"count", price:10000, unitLabel:"세트" },
      { id:"bed_l", label:"침대(대형)", type:"count", price:20000, unitLabel:"세트" },
      { id:"wardrobe", label:"장롱(2~3칸)", type:"count", price:30000, unitLabel:"개" },
      { id:"desk", label:"책상/책장", type:"count", price:10000, unitLabel:"개" },
      { id:"small", label:"소형가구", type:"count", price:5000, unitLabel:"개" },
    ],
  };

  const [cfg, setCfg] = useState(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch {}
    return defaultCfg;
  });

  useEffect(()=>{ try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch {} }, [cfg]);

  const [state, setState] = useState({
    distanceKm: 8,
    floors: 1,
    hasElevator: true,
    helpers: 0,
    weekend: false,
    items: Object.fromEntries((cfg.items||[]).map(i=>[i.id,0]))
  });

  useEffect(()=>{
    setState((prev)=>{
      const nextItems = { ...prev.items };
      (cfg.items||[]).forEach(i=>{ if(!(i.id in nextItems)) nextItems[i.id]=0; });
      Object.keys(nextItems).forEach(k=>{ if(!(cfg.items||[]).find(i=> i.id===k)) delete nextItems[k]; });
      return { ...prev, items: nextItems };
    });
  }, [cfg.items]);

  const itemsSum = useMemo(()=>{
    return (cfg.items||[]).reduce((sum,i)=> sum + (Number(state.items[i.id]||0) * (Number(i.price)||0)), 0);
  },[cfg, state]);

  const total = useMemo(()=>{
    const base = Number(cfg.baseFee)||0;
    const distExtra = Math.max(0, (Number(state.distanceKm)||0) - (Number(cfg.baseDistanceKm)||0)) * (Number(cfg.extraPerKm)||0);
    const floorExtra = state.hasElevator ? 0 : Math.max(0,(Number(state.floors)||0)) * (Number(cfg.noElevPerFloor)||0);
    const helperExtra = (Number(state.helpers)||0) * (Number(cfg.helperFee)||0);
    const subtotal = base + itemsSum + distExtra + floorExtra + helperExtra;
    const weekendMul = state.weekend ? (1 + (Number(cfg.weekendRate)||0)) : 1;
    const t = Math.round(subtotal * weekendMul);
    return { base, distExtra, floorExtra, helperExtra, subtotal, weekendMul, t };
  },[cfg, state, itemsSum]);

  const exportCfg = async () => { const text = JSON.stringify(cfg, null, 2); try{ await navigator.clipboard.writeText(text); alert("설정을 클립보드에 복사했습니다."); } catch { alert(text); } };
  const importCfg = () => { const text = prompt("붙여넣기 할 설정 JSON을 입력하세요:"); if(!text) return; try { const obj = JSON.parse(text); setCfg(obj); } catch { alert("JSON 파싱 실패"); } };
  const resetCfg = () => setCfg(defaultCfg);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">가정 대형 폐기물 내림 서비스 계산기</h1>
      <p className="text-center text-sm text-gray-600 mb-6">지자체 대형폐기물 신고/스티커는 고객 실비 부담이며, 본 계산기는 수거·운반 서비스 요금 예시입니다.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <section className="bg-white rounded-2xl shadow p-4 sm:p-5">
          <h2 className="font-semibold mb-3">고객 입력</h2>
          <div className="space-y-4">
            <Labeled>
              <label className="font-medium">거리 (왕복 km)</label>
              <NumberBox value={state.distanceKm} onChange={(v)=> setState(s=>({...s, distanceKm:v}))} suffix="km" />
              <p className="text-xs text-gray-500">기본 {cfg.baseDistanceKm}km 포함, 초과 km당 {currency(cfg.extraPerKm)}원</p>
            </Labeled>

            <div className="grid grid-cols-2 gap-4">
              <Labeled>
                <label className="font-medium">층수</label>
                <NumberBox value={state.floors} onChange={(v)=> setState(s=>({...s, floors:v}))} />
              </Labeled>
              <Labeled>
                <label className="font-medium">엘리베이터</label>
                <Toggle checked={state.hasElevator} onChange={(v)=> setState(s=>({...s, hasElevator:v}))} trueLabel="있음" falseLabel="없음" />
              </Labeled>
            </div>

            <Labeled>
              <label className="font-medium">보조 인력</label>
              <NumberBox value={state.helpers} onChange={(v)=> setState(s=>({...s, helpers:v}))} suffix="명" />
            </Labeled>

            <Labeled>
              <label className="font-medium">주말/야간</label>
              <Toggle checked={state.weekend} onChange={(v)=> setState(s=>({...s, weekend:v}))} trueLabel="적용" falseLabel="미적용" />
            </Labeled>

            <Labeled>
              <label className="font-medium">품목 수량</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(cfg.items||[]).map(it=> (
                  <div key={it.id} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
                    <div className="text-sm">
                      <div className="font-medium">{it.label}</div>
                      <div className="text-xs text-gray-500">{it.unitLabel||"개"}당 {currency(it.price)}원</div>
                    </div>
                    <NumberBox value={state.items[it.id]||0} onChange={(v)=> setState(s=>({...s, items:{...s.items, [it.id]:v}}))} suffix={it.unitLabel||"개"} />
                  </div>
                ))}
              </div>
            </Labeled>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 sm:p-5 flex flex-col">
          <h2 className="font-semibold mb-3">예상 요금</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="기본요금">{currency(total.base)}원</InfoRow>
            <InfoRow label="품목 추가합">{currency(itemsSum)}원</InfoRow>
            <InfoRow label="거리 추가">{currency(total.distExtra)}원</InfoRow>
            <InfoRow label="층수 추가(무엘리베이터)">{currency(total.floorExtra)}원</InfoRow>
            <InfoRow label="보조 인력">{currency(total.helperExtra)}원</InfoRow>
            <InfoRow label="주말/야간 가중치">× {total.weekendMul.toFixed(2)}</InfoRow>
          </div>
          <div className="my-4 p-4 rounded-xl bg-gray-50 border">
            <div className="text-sm text-gray-600">고객 결제 예상</div>
            <div className="text-2xl font-bold mt-1">{currency(total.t)}원</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=> copyQuote(cfg, state, total, cfg.items)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">견적 내용 복사</button>
            <button type="button" onClick={()=> downloadPDF(cfg, state, total, cfg.items)} className="rounded-xl px-3 py-2 text-sm bg-black text-white">PDF 견적서 다운로드</button>
            <button type="button" onClick={()=> shareQuote(cfg, state, total, cfg.items)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">공유</button>
          </div>
          <div className="text-xs text-gray-500 mt-2">※ 지자체 대형폐기물 스티커 비용은 별도(실비)입니다.</div>
        </section>
      </div>

      <details className="mt-8 bg-white rounded-2xl shadow p-4 sm:p-5" open>
        <summary className="cursor-pointer font-semibold">운영자 설정</summary>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <ConfigText label="상호/브랜드명" value={cfg.bizName} onChange={(v)=> setCfg(prev=>({...prev, bizName:v}))} />
          <ConfigText label="연락처" value={cfg.bizPhone} onChange={(v)=> setCfg(prev=>({...prev, bizPhone:v}))} />
          <ConfigText label="이메일" value={cfg.bizEmail} onChange={(v)=> setCfg(prev=>({...prev, bizEmail:v}))} />
          <ConfigNumber label="기본요금" value={cfg.baseFee} onChange={(v)=> setCfg(prev=>({...prev, baseFee:v}))} />
          <ConfigNumber label="기본거리(km)" value={cfg.baseDistanceKm} onChange={(v)=> setCfg(prev=>({...prev, baseDistanceKm:v}))} />
          <ConfigNumber label="초과 km당" value={cfg.extraPerKm} onChange={(v)=> setCfg(prev=>({...prev, extraPerKm:v}))} />
          <ConfigNumber label="무엘베 층당" value={cfg.noElevPerFloor} onChange={(v)=> setCfg(prev=>({...prev, noElevPerFloor:v}))} />
          <ConfigNumber label="주말/야간 가산율(예:0.2)" value={cfg.weekendRate} onChange={(v)=> setCfg(prev=>({...prev, weekendRate:Number(v)}))} />
          <ConfigNumber label="보조 1인 비용" value={cfg.helperFee} onChange={(v)=> setCfg(prev=>({...prev, helperFee:v}))} />
        </div>
        <div className="mt-6">
          <h4 className="font-semibold mb-2">품목 단가</h4>
          <ItemsBuilder cfg={cfg} setCfg={setCfg} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={exportCfg} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">설정 내보내기</button>
          <button type="button" onClick={importCfg} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">설정 불러오기</button>
          <button type="button" onClick={resetCfg} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">기본값 복원</button>
        </div>
      </details>
    </div>
  );
}

// ===== 유틸: 요약문/복사/공유/PDF =====
function buildQuoteText(cfg, state, total, items) {
  const line = (k,v)=> `${k}: ${v}`;
  const date = new Date().toLocaleString();
  const itemsStr = (items||[])
    .map(i=> `${i.label} ${state.items?.[i.id]||0}${i.unitLabel||"개"}`)
    .filter(s=> !/ 0/.test(s))
    .join("\n");
  return [
    `[가정 대형 폐기물 내림 서비스 견적]`,
    line("일시", date),
    cfg.bizName? line("업체", cfg.bizName): null,
    cfg.bizPhone? line("연락처", cfg.bizPhone): null,
    cfg.bizEmail? line("이메일", cfg.bizEmail): null,
    "",
    line("거리(왕복)", `${state.distanceKm}km`),
    line("층수", `${state.floors}층 / 엘리베이터 ${state.hasElevator?"있음":"없음"}`),
    line("보조 인력", `${state.helpers}명`),
    line("주말/야간", state.weekend?"적용":"미적용"),
    "",
    itemsStr? `품목:\n${itemsStr}`: "품목: 없음",
    "",
    line("예상 결제 금액", `${(Number(total.t)||0).toLocaleString("ko-KR")}원`),
    "(대형폐기물 스티커 비용 별도)"
  ].filter(Boolean).join("\n");
}

async function copyQuote(cfg, state, total, items){
  const text = buildQuoteText(cfg, state, total, items);
  try { await navigator.clipboard.writeText(text); alert("견적 내용을 클립보드에 복사했습니다."); }
  catch { alert(text); }
}

function shareQuote(cfg, state, total, items){
  const text = buildQuoteText(cfg, state, total, items);
  if (navigator.share) {
    navigator.share({ title: "가정 대형 폐기물 내림 서비스 견적", text });
  } else {
    copyQuote(cfg, state, total, items);
  }
}

function downloadPDF(cfg, state, total, items){
  const doc = new jsPDF();
  const left = 14; let y = 20;
  doc.setFontSize(16); doc.text("가정 대형 폐기물 내림 서비스 견적서", left, y); y += 8;
  doc.setFontSize(11);
  const bizLine = [cfg.bizName, cfg.bizPhone, cfg.bizEmail].filter(Boolean).join("  •  ");
  if (bizLine) { doc.text(bizLine, left, y); y += 8; }
  doc.text(`작성일시: ${new Date().toLocaleString()}`, left, y); y += 10;

  const rows = [];
  rows.push(["거리(왕복)", `${state.distanceKm} km`]);
  rows.push(["층수/엘리베이터", `${state.floors}층 / ${state.hasElevator?"엘리베이터 있음":"없음"}`]);
  rows.push(["보조 인력", `${state.helpers} 명`]);
  rows.push(["주말/야간", state.weekend?"적용":"미적용" ]);

  // 표 비슷하게 출력
  rows.forEach(r=> { doc.text(`${r[0]}: ${r[1]}`, left, y); y += 7; });
  y += 3;
  doc.setFont(undefined, "bold"); doc.text("품목", left, y); doc.setFont(undefined, "normal"); y += 7;
  (items||[]).forEach(i=>{
    const qty = Number(state.items?.[i.id]||0);
    if(qty>0){ doc.text(`- ${i.label}: ${qty}${i.unitLabel||"개"}`, left, y); y += 6; }
  });
  y += 4;
  doc.setFont(undefined, "bold"); doc.text(`예상 결제 금액: ${(Number(total.t)||0).toLocaleString("ko-KR")}원`, left, y); doc.setFont(undefined, "normal"); y += 8;
  doc.setFontSize(10); doc.text("※ 지자체 대형폐기물 스티커 비용은 별도(실비)입니다.", left, y);
  doc.save("견적서.pdf");
}

function Labeled({ children }) { return <div className="space-y-1.5">{children}</div>; }

function NumberBox({ value, onChange, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" className="w-28 px-3 py-2 rounded-xl border" value={value} onChange={(e)=> onChange(Number(e.target.value))} />
      {suffix && <span className="text-gray-600 text-sm">{suffix}</span>}
    </div>
  );
}

function Toggle({ checked, onChange, trueLabel = "예", falseLabel = "아니오" }) {
  return (
    <button type="button" onClick={()=> onChange(!checked)} className={`w-full rounded-xl border px-3 py-2 text-sm ${checked?"bg-black text-white":"bg-white"}`}>{checked?trueLabel:falseLabel}</button>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between border-b last:border-b-0 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function ConfigNumber({ label, value, onChange }) {
  const [v, setV] = useState(value);
  useEffect(()=> setV(value), [value]);
  return (
    <label className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
      <span className="text-gray-600 text-sm">{label}</span>
      <input type="number" className="w-40 px-3 py-1.5 rounded-lg border" value={v} onChange={(e)=>{ const n = e.target.value === "" ? 0 : Number(e.target.value); setV(n); onChange(n); }} />
    </label>
  );
}

function ConfigText({ label, value, onChange }){
  const [v, setV] = useState(value||"");
  useEffect(()=> setV(value||""), [value]);
  return (
    <label className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
      <span className="text-gray-600 text-sm">{label}</span>
      <input type="text" className="w-56 px-3 py-1.5 rounded-lg border" value={v} onChange={(e)=>{ setV(e.target.value); onChange(e.target.value); }} />
    </label>
  );
}

function ItemsBuilder({ cfg, setCfg }) {
  const [local, setLocal] = useState(cfg.items || []);
  useEffect(()=> setLocal(cfg.items||[]), [cfg.items]);

  const updateLocal = (idx, patch) => setLocal((prev)=> prev.map((o,i)=> i===idx?{...o,...patch}:o));
  const addItem = () => { const id = `itm_${Math.random().toString(36).slice(2,8)}`; setLocal((prev)=> [...prev,{ id, label:"새 품목", type:"count", price:0, unitLabel:"개" }]); };
  const removeItem = (idx) => setLocal((prev)=> prev.filter((_,i)=> i!==idx));
  const apply = () => setCfg((prev)=> ({ ...prev, items: local }));

  return (
    <div className="space-y-3">
      {local.map((o,idx)=>(
        <div key={o.id} className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 border rounded-2xl p-3">
          <input className="md:col-span-5 border rounded-xl px-3 py-2 text-sm" value={o.label} onChange={(e)=> updateLocal(idx,{label:e.target.value})} placeholder="품목명" />
          <input type="text" className="md:col-span-3 border rounded-xl px-3 py-2 text-sm" value={o.unitLabel||"개"} onChange={(e)=> updateLocal(idx,{unitLabel:e.target.value})} placeholder="단위(개/대/세트 등)" />
          <input type="number" className="md:col-span-3 border rounded-xl px-3 py-2 text-sm" value={o.price} onChange={(e)=> updateLocal(idx,{price:Number(e.target.value)})} placeholder="단가(원)" />
          <button type="button" onClick={()=> removeItem(idx)} className="ml-auto rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">삭제</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button type="button" onClick={addItem} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">+ 품목 추가</button>
        <button type="button" onClick={apply} className="rounded-xl px-3 py-2 text-sm bg-black text-white">단가 적용</button>
      </div>
    </div>
  );
}

// ===== 개발용 간단 테스트 (콘솔) =====
(function runDevTests(){
  try {
    const cfg = { bizName:"테스트", bizPhone:"010-0000-0000", bizEmail:"a@b.c", items:[{id:"x", label:"의자", unitLabel:"개", price:5000}] };
    const state = { distanceKm: 12, floors: 3, hasElevator:false, helpers:1, weekend:true, items:{ x:2 } };
    const total = { t: 123456 };
    const txt = buildQuoteText(cfg, state, total, cfg.items);
    console.assert(txt.includes("의자 2개"), "품목 수량 누락");
    console.assert(txt.includes("예상 결제 금액"), "금액 줄 누락");
  } catch(e) { console.warn("DevTests 실패:", e); }
})();
