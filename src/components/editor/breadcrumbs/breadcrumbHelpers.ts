import { invoke } from "@tauri-apps/api/core";
import { getProjectPath } from "@/utils/workspace";
import { getFileIcon } from "@/utils/fileIcons";
import type { DocumentSymbol } from "@/context/OutlineContext";
import type { SymbolInfo } from "./breadcrumbTypes";

export const copyBreadcrumbsPath = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) return false;
  try {
    await navigator.clipboard.writeText(filePath);
    return true;
  } catch {
    return false;
  }
};

export const copyBreadcrumbsRelativePath = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) return false;
  const projectPath = getProjectPath();
  try {
    if (projectPath) {
      const normalizedFile = filePath.replace(/\\/g, "/");
      const normalizedProject = projectPath.replace(/\\/g, "/");
      let relativePath = normalizedFile;
      if (normalizedFile.toLowerCase().startsWith(normalizedProject.toLowerCase())) {
        relativePath = normalizedFile.substring(normalizedProject.length).replace(/^[\/\\]/, '');
      }
      await navigator.clipboard.writeText(relativePath);
    } else {
      await navigator.clipboard.writeText(filePath);
    }
    return true;
  } catch {
    return false;
  }
};

export const revealBreadcrumbsInExplorer = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) return false;
  try {
    await invoke("fs_reveal_in_explorer", { path: filePath });
    return true;
  } catch {
    return false;
  }
};

export const getFileIconPath = (filename: string): string => {
  return getFileIcon(filename, false);
};

export const convertToSymbolInfo = (symbol: DocumentSymbol, depth: number = 0): SymbolInfo => ({
  id: symbol.id,
  name: symbol.name,
  kind: symbol.kind,
  detail: symbol.detail,
  range: {
    startLine: symbol.range.startLine,
    startColumn: symbol.range.startColumn,
    endLine: symbol.range.endLine,
    endColumn: symbol.range.endColumn,
  },
  children: symbol.children.map(c => convertToSymbolInfo(c, depth + 1)),
  depth,
});

export const findSymbolAtPosition = (
  symbols: SymbolInfo[],
  line: number,
  _column: number
): SymbolInfo[] => {
  const path: SymbolInfo[] = [];
  
  const findInSymbols = (syms: SymbolInfo[]): boolean => {
    for (const sym of syms) {
      if (
        line >= sym.range.startLine &&
        line <= sym.range.endLine
      ) {
        path.push(sym);
        if (sym.children.length > 0) {
          findInSymbols(sym.children);
        }
        return true;
      }
    }
    return false;
  };
  
  findInSymbols(symbols);
  return path;
};

export const flattenSymbols = (symbols: SymbolInfo[], result: SymbolInfo[] = []): SymbolInfo[] => {
  for (const sym of symbols) {
    result.push(sym);
    if (sym.children.length > 0) {
      flattenSymbols(sym.children, result);
    }
  }
  return result;
};
