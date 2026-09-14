import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

// xlsx-js-style does not serialize page setup. Add native Excel print settings
// to the generated worksheet XML without changing cell values or styles.
export function fitWorkbookToLandscapeA4(data) {
  const files = unzipSync(new Uint8Array(data));
  for (const path of Object.keys(files)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue;
    let xml = strFromU8(files[path]);
    const setup = '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
    const margins = '<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>';
    xml = xml.replace(/<pageSetup\b[^>]*\/>/g, "").replace(/<pageMargins\b[^>]*\/>/g, "");
    if (/<sheetPr\b/.test(xml)) {
      xml = xml.replace(/<pageSetUpPr\b[^>]*\/>/g, "");
      xml = xml.replace(/<sheetPr([^>]*?)\/>/, '<sheetPr$1></sheetPr>');
      xml = xml.replace('</sheetPr>', '<pageSetUpPr fitToPage="1"/></sheetPr>');
    } else {
      xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    }
    // These generated sheets have no drawings or footer elements after margins.
    xml = xml.replace('</worksheet>', `${margins}${setup}</worksheet>`);
    files[path] = strToU8(xml);
  }
  return zipSync(files);
}
