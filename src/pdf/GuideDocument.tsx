import { Document, G, Image, Line, Page, Rect, StyleSheet, Svg, Text, Text as PdfText, View } from '@react-pdf/renderer';
import type { ComponentType } from 'react';

// react-pdf's SVG <Text> reads fontSize/fontFamily from props at runtime, but its typings
// only declare the presentation attributes, so widen the type for chart labels.
const SvgText = PdfText as unknown as ComponentType<Record<string, unknown>>;
import type { PageSize, Pattern } from '../shared/types';
import { formatRow, runsForRow } from '../domain/legend/wordchart';
import { pageTiles } from './chart-pager';

export interface GuideProps {
  pattern: Pattern;
  projectTitle: string;
  projectUrl: string;
  /** PNG data URI of the whole pattern, for the cover. */
  previewDataUri: string;
  generatedAt: string;
}

const PT_PER_MM = 72 / 25.4;
const MARGIN_MM = 14;
const PAGE_MM: Record<PageSize, { w: number; h: number }> = { LETTER: { w: 215.9, h: 279.4 }, A4: { w: 210, h: 297 } };
const CELL_MM = 5; // working chart cell size: large enough to read a symbol at arm's length
const GUTTER_MM = 7; // row/column number gutters

const styles = StyleSheet.create({
  page: { padding: MARGIN_MM * PT_PER_MM, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  h1: { fontSize: 24, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  h2: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 8, marginTop: 4 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 6, lineHeight: 1.4 },
  small: { fontSize: 8, color: '#555' },
  footer: { position: 'absolute', bottom: 8 * PT_PER_MM, left: MARGIN_MM * PT_PER_MM, right: MARGIN_MM * PT_PER_MM, fontSize: 8, color: '#666', flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row' },
  kv: { flexDirection: 'row', marginBottom: 2 },
  k: { width: 110, color: '#555' },
  table: { marginTop: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 3, alignItems: 'center' },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#444' },
  swatch: { width: 14, height: 14, borderWidth: 0.5, borderColor: '#999', marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  cSym: { width: 24 },
  cCode: { width: 50 },
  cName: { flexGrow: 1 },
  cFinish: { width: 60 },
  cNum: { width: 46, textAlign: 'right' },
  wordRow: { flexDirection: 'row', marginBottom: 3 },
  wordLabel: { width: 48, fontFamily: 'Helvetica-Bold' },
  wordText: { flexGrow: 1, flexShrink: 1 },
});

function Footer({ title, pageLabel }: { title: string; pageLabel: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{title}</Text>
      <Text>{pageLabel}</Text>
    </View>
  );
}

function mm(v: number) {
  return v * PT_PER_MM;
}

function fmtMm(v: number) {
  return `${v.toFixed(0)} mm (${(v / 25.4).toFixed(1)} in)`;
}

/** The chart grid as SVG: cells with fill + symbol, bold line every 10, numbers in gutters. */
function ChartSvg({ pattern, col0, col1, row0, row1, cellMm, symbols, numbers }: {
  pattern: Pattern; col0: number; col1: number; row0: number; row1: number; cellMm: number; symbols: boolean; numbers: boolean;
}) {
  const g = numbers ? GUTTER_MM : 0;
  const cols = col1 - col0;
  const rows = row1 - row0;
  const W = mm(cols * cellMm + 2 * g);
  const H = mm(rows * cellMm + 2 * g);
  const cell = mm(cellMm);
  const ox = mm(g);
  const oy = mm(g);
  const legend = pattern.legend;
  const rects = [];
  const texts = [];
  for (let r = row0; r < row1; r++) {
    for (let c = col0; c < col1; c++) {
      const idx = pattern.cells[r * pattern.width + c];
      const entry = legend[idx];
      const x = ox + (c - col0) * cell;
      const y = oy + (r - row0) * cell;
      rects.push(<Rect key={`r${r}-${c}`} x={x} y={y} width={cell} height={cell} fill={entry?.bead.hex ?? '#ff00ff'} />);
      if (symbols && entry) {
        texts.push(
          <SvgText key={`t${r}-${c}`} x={x + cell / 2} y={y + cell * 0.72} fontSize={cell * 0.55} fill={entry.textColor} textAnchor="middle" fontFamily="Helvetica-Bold">
            {entry.symbol}
          </SvgText>,
        );
      }
    }
  }
  const lines = [];
  for (let c = col0; c <= col1; c++) {
    const bold = c % 10 === 0;
    const x = ox + (c - col0) * cell;
    lines.push(<Line key={`v${c}`} x1={x} y1={oy} x2={x} y2={oy + rows * cell} stroke={bold ? '#000' : '#666'} strokeWidth={bold ? 1.2 : 0.3} />);
  }
  for (let r = row0; r <= row1; r++) {
    const bold = r % 10 === 0;
    const y = oy + (r - row0) * cell;
    lines.push(<Line key={`h${r}`} x1={ox} y1={y} x2={ox + cols * cell} y2={y} stroke={bold ? '#000' : '#666'} strokeWidth={bold ? 1.2 : 0.3} />);
  }
  const nums = [];
  if (numbers) {
    const fs = Math.min(8, cell * 0.5);
    for (let c = col0; c < col1; c++) {
      const n = c + 1;
      if (n % 5 !== 0 && n !== 1 && n !== col1) continue;
      const x = ox + (c - col0) * cell + cell / 2;
      nums.push(<SvgText key={`cn${c}`} x={x} y={oy - mm(1.5)} fontSize={fs} textAnchor="middle" fill="#222">{String(n)}</SvgText>);
      nums.push(<SvgText key={`cs${c}`} x={x} y={oy + rows * cell + mm(1.5) + fs} fontSize={fs} textAnchor="middle" fill="#222">{String(n)}</SvgText>);
    }
    for (let r = row0; r < row1; r++) {
      const n = r + 1;
      const y = oy + (r - row0) * cell + cell / 2 + fs / 3;
      nums.push(<SvgText key={`rn${r}`} x={ox - mm(1.5)} y={y} fontSize={fs} textAnchor="end" fill="#222">{String(n)}</SvgText>);
      nums.push(<SvgText key={`re${r}`} x={ox + cols * cell + mm(1.5)} y={y} fontSize={fs} textAnchor="start" fill="#222">{String(n)}</SvgText>);
    }
  }
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <G>{rects}</G>
      <G>{lines}</G>
      <G>{texts}</G>
      <G>{nums}</G>
    </Svg>
  );
}

export function GuideDocument({ pattern, projectTitle, projectUrl, previewDataUri, generatedAt }: GuideProps) {
  const size = PAGE_MM[pattern.settings.pageSize];
  const usableW = size.w - 2 * MARGIN_MM;
  const usableH = size.h - 2 * MARGIN_MM - 10; // leave room for the footer
  const spec = pattern.beadSpec;
  const t = pattern.totals;
  const symbolOf = (i: number) => pattern.legend[i]?.symbol ?? '?';

  // overview: scale to fit one page
  const ovCell = Math.min((usableW - 2 * GUTTER_MM) / pattern.width, (usableH - 2 * GUTTER_MM - 12) / pattern.height);
  // working chart tiles
  const colsPerPage = Math.max(1, Math.floor((usableW - 2 * GUTTER_MM) / CELL_MM));
  const rowsPerPage = Math.max(1, Math.floor((usableH - 2 * GUTTER_MM - 12) / CELL_MM));
  const tiles = pageTiles({ width: pattern.width, height: pattern.height, colsPerPage, rowsPerPage, overlap: 2 });

  const pageSize = pattern.settings.pageSize;
  const footerTitle = `${projectTitle} — SBA pattern v${pattern.version}`;

  return (
    <Document title={`${projectTitle} – bead pattern`} author="SBA" subject="Seed bead loom pattern">
      {/* 1. Cover */}
      <Page size={pageSize} style={styles.page}>
        <Text style={styles.h1}>{projectTitle}</Text>
        <Text style={[styles.p, styles.small]}>Seed bead pattern · generated {generatedAt.slice(0, 10)} · version {pattern.version}</Text>
        <View style={{ marginVertical: 10, alignItems: 'center' }}>
          <Image src={previewDataUri} style={{ maxWidth: mm(usableW), maxHeight: mm(usableH * 0.5), objectFit: 'contain' }} />
        </View>
        <View style={styles.kv}><Text style={styles.k}>Beads</Text><Text>{spec.brand} {spec.line} {spec.size}</Text></View>
        <View style={styles.kv}><Text style={styles.k}>Technique</Text><Text>Loom (or square stitch)</Text></View>
        <View style={styles.kv}><Text style={styles.k}>Pattern size</Text><Text>{pattern.width} beads wide × {pattern.height} rows</Text></View>
        <View style={styles.kv}><Text style={styles.k}>Finished size</Text><Text>{fmtMm(t.widthMm)} × {fmtMm(t.heightMm)}{pattern.settings.calibration ? ' (calibrated)' : ' (estimated)'}</Text></View>
        <View style={styles.kv}><Text style={styles.k}>Total beads</Text><Text>{t.beads.toLocaleString()} ({t.grams.toFixed(1)} g) in {pattern.legend.length} colours</Text></View>
        <View style={styles.kv}><Text style={styles.k}>Project link</Text><Text>{projectUrl}</Text></View>
        <Text style={[styles.p, styles.small, { marginTop: 14 }]}>
          This PDF is the keepsake. The project link above works for about a day, then the project and photo are deleted; there are no accounts or backups.
        </Text>
        <Footer title={footerTitle} pageLabel="Cover" />
      </Page>

      {/* 2. Getting started */}
      <Page size={pageSize} style={styles.page}>
        <Text style={styles.h2}>Getting started with loom beading</Text>
        <Text style={styles.p}>
          This pattern is drawn on a plain grid, which is exactly how beads sit on a bead loom: each row of the chart is one pass of the needle, and each square is one bead. If you have never beaded before, loom work is the easiest way to turn a picture into beads.
        </Text>
        <Text style={styles.h3}>What to buy</Text>
        <Text style={styles.p}>• A bead loom. Michaels carries Beadsmith looms; any loom at least {Math.ceil(t.widthMm / 10) + 2} cm wide and {Math.ceil(t.heightMm / 10) + 10} cm long will fit this piece.</Text>
        <Text style={styles.p}>• Beading needles, size 10 or 12 (thin enough to pass through an 11/0 bead several times).</Text>
        <Text style={styles.p}>• Beading thread: Nymo size D or FireLine 6 lb. You need about {Math.ceil(t.threadMeters)} m including warps.</Text>
        <Text style={styles.p}>• The beads listed on the Materials page. Buy one extra tube of your main colour.</Text>
        <Text style={styles.h3}>Warp the loom</Text>
        <Text style={styles.p}>
          Tie on {t.warpThreads} warp threads (one more than the {pattern.width} beads in a row), evenly spaced in the loom's grooves, pulled snug but not tight. Leave at least 15 cm of thread at each end for finishing.
        </Text>
        <Text style={styles.h3}>Weave a row</Text>
        <Text style={styles.p}>
          Thread the needle with about 1.5 m of weft thread and tie it to the leftmost warp. Pick up the beads for row 1 in order from the chart or the Word chart, pass the needle <Text style={{ fontFamily: 'Helvetica-Bold' }}>under</Text> the warps, and push the beads up with a finger so one bead sits between each pair of warps. Then pass the needle back through all the beads <Text style={{ fontFamily: 'Helvetica-Bold' }}>over</Text> the warps. Repeat for each row, always reading left to right.
        </Text>
        <Text style={styles.h3}>Reading the charts</Text>
        <Text style={styles.p}>
          The Overview page shows the whole picture. The Working chart pages show it at a readable size with a letter in every square; the letters match the Materials list. Heavy lines mark every 10 beads, and numbers along the edges count beads and rows. Pages overlap by two beads so you can line them up. The Word chart writes each row out as runs, e.g. "4×A, 2×C" means four of bead A then two of bead C.
        </Text>
        <Text style={styles.h3}>Check the size first (optional but recommended)</Text>
        <Text style={styles.p}>
          Bead sizes vary a little between colours. Weave a 10 × 10 bead test square, measure its width and height in millimetres, and enter both in the project's Calibration fields. The pattern will be re-proportioned so the finished piece matches the photo.
        </Text>
        <Footer title={footerTitle} pageLabel="Getting started" />
      </Page>

      {/* 3. Materials */}
      <Page size={pageSize} style={styles.page}>
        <Text style={styles.h2}>Materials</Text>
        <Text style={styles.p}>
          {spec.brand} {spec.line} {spec.size} seed beads, about {spec.beadsPerGram} beads per gram, sold in {spec.packageGrams} g tubes. Tube counts include a 15% allowance for culls. Where to buy: {spec.whereToBuy}.
        </Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <View style={{ width: 20 }} />
            <Text style={[styles.th, styles.cSym]}>Sym</Text>
            <Text style={[styles.th, styles.cCode]}>Code</Text>
            <Text style={[styles.th, styles.cName]}>Colour</Text>
            <Text style={[styles.th, styles.cFinish]}>Finish</Text>
            <Text style={[styles.th, styles.cNum]}>Beads</Text>
            <Text style={[styles.th, styles.cNum]}>Grams</Text>
            <Text style={[styles.th, styles.cNum]}>Tubes</Text>
          </View>
          {pattern.legend.map((l) => (
            <View key={l.index} style={styles.tr} wrap={false}>
              <View style={[styles.swatch, { backgroundColor: l.bead.hex }]}>
                <Text style={{ fontSize: 8, color: l.textColor, fontFamily: 'Helvetica-Bold' }}>{l.symbol}</Text>
              </View>
              <Text style={styles.cSym}>{l.symbol}</Text>
              <Text style={styles.cCode}>{l.bead.code}</Text>
              <Text style={styles.cName}>{l.bead.name}</Text>
              <Text style={styles.cFinish}>{l.bead.finish}</Text>
              <Text style={styles.cNum}>{l.count.toLocaleString()}</Text>
              <Text style={styles.cNum}>{l.grams.toFixed(1)}</Text>
              <Text style={styles.cNum}>{l.tubes}</Text>
            </View>
          ))}
          <View style={[styles.tr, { borderBottomWidth: 0 }]}>
            <View style={{ width: 20 }} />
            <Text style={[styles.th, styles.cSym]} />
            <Text style={[styles.th, styles.cCode]} />
            <Text style={[styles.th, styles.cName]}>Total</Text>
            <Text style={[styles.th, styles.cFinish]} />
            <Text style={[styles.th, styles.cNum]}>{t.beads.toLocaleString()}</Text>
            <Text style={[styles.th, styles.cNum]}>{t.grams.toFixed(1)}</Text>
            <Text style={[styles.th, styles.cNum]}>{pattern.legend.reduce((s, l) => s + l.tubes, 0)}</Text>
          </View>
        </View>
        <Text style={styles.h3}>Thread and loom</Text>
        <Text style={styles.p}>{t.warpThreads} warp threads · about {Math.ceil(t.threadMeters)} m of thread in total · finished size {fmtMm(t.widthMm)} × {fmtMm(t.heightMm)}.</Text>
        <Footer title={footerTitle} pageLabel="Materials" />
      </Page>

      {/* 4. Overview */}
      <Page size={pageSize} style={styles.page}>
        <Text style={styles.h2}>Overview</Text>
        <ChartSvg pattern={pattern} col0={0} col1={pattern.width} row0={0} row1={pattern.height} cellMm={ovCell} symbols={ovCell >= 3.2} numbers />
        <Footer title={footerTitle} pageLabel="Overview" />
      </Page>

      {/* 5. Working chart */}
      {tiles.map((tile) => (
        <Page key={tile.pageIndex} size={pageSize} style={styles.page}>
          <Text style={styles.h2}>
            Working chart {tiles.length > 1 ? `${tile.pageIndex + 1} of ${tiles.length}` : ''} — columns {tile.col0 + 1}–{tile.col1}, rows {tile.row0 + 1}–{tile.row1}
          </Text>
          <ChartSvg pattern={pattern} col0={tile.col0} col1={tile.col1} row0={tile.row0} row1={tile.row1} cellMm={CELL_MM} symbols numbers />
          <Footer title={footerTitle} pageLabel={`Chart ${tile.pageIndex + 1}/${tiles.length}`} />
        </Page>
      ))}

      {/* 6. Word chart */}
      <Page size={pageSize} style={styles.page}>
        <Text style={styles.h2}>Word chart</Text>
        <Text style={[styles.p, styles.small]}>Each row reads left to right. "4×A" means four beads of colour A. Rows run from the top of the picture down.</Text>
        {Array.from({ length: pattern.height }, (_, r) => (
          <View key={r} style={styles.wordRow} wrap={false}>
            <Text style={styles.wordLabel}>Row {r + 1}</Text>
            <Text style={styles.wordText}>{formatRow(runsForRow(pattern.cells, pattern.width, r), symbolOf)}</Text>
          </View>
        ))}
        <Footer title={footerTitle} pageLabel="Word chart" />
      </Page>
    </Document>
  );
}
