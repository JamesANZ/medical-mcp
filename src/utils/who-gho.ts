import type { WHOIndicator } from "../types.js";
import { formatNumericDisplay } from "./text.js";

const SEX_LABELS: Record<string, string> = {
  MLE: "Male",
  FMLE: "Female",
  BTSX: "Both sexes",
  MALE: "Male",
  FEMALE: "Female",
};

export function formatWhoSex(code?: string): string {
  if (!code) return "";
  return SEX_LABELS[code.toUpperCase()] || code;
}

export function formatWhoDimension(
  type?: string,
  value?: string,
): { label: string; text: string } | undefined {
  if (!value) return undefined;
  const inferredSex = inferSexLabel(value);
  const upper = (type || "").toUpperCase();
  if (upper === "SEX" || inferredSex) {
    return { label: "Sex", text: inferredSex || formatWhoSex(value) };
  }
  if (upper === "AGEGROUP" || upper === "AGE") {
    return { label: "Age Group", text: value };
  }
  if (!type) return undefined;
  return { label: type, text: value };
}

function inferSexLabel(value?: string): string {
  if (!value) return "";
  const normalized = value.toUpperCase().replace(/^SEX[_-]?/, "");
  return SEX_LABELS[normalized] || "";
}

type WhoDataItem = {
  SpatialDim?: string;
  SpatialDimType?: string;
  TimeDim?: string | number;
  TimeDimType?: string;
  DataSourceDim?: string;
  DataSourceType?: string;
  NumericValue?: number | null;
  Value?: string | number;
  Low?: number;
  High?: number;
  LowerBound?: number;
  UpperBound?: number;
  Unit?: string;
  Date?: string;
  Dim1Type?: string;
  Dim1?: string;
  Dim2Type?: string;
  Dim2?: string;
  Dim3Type?: string;
  Dim3?: string;
  Sex?: string;
  Gender?: string;
  AgeGroup?: string;
  Age?: string;
};

export function mapWhoDataValue(
  item: WhoDataItem,
  indicator: { IndicatorCode: string; IndicatorName: string },
): WHOIndicator | null {
  const value = item.NumericValue;
  if (value === null || value === undefined) {
    return null;
  }

  const unit = item.Unit && item.Unit !== "Unknown" ? item.Unit : "";
  const year = item.TimeDim != null ? String(item.TimeDim) : "Unknown";
  const dims = [
    formatWhoDimension(item.Dim1Type, item.Dim1),
    formatWhoDimension(item.Dim2Type, item.Dim2),
    formatWhoDimension(item.Dim3Type, item.Dim3),
    item.Sex || item.Gender
      ? { label: "Sex", text: formatWhoSex(item.Sex || item.Gender) }
      : undefined,
    item.AgeGroup || item.Age
      ? { label: "Age Group", text: String(item.AgeGroup || item.Age) }
      : undefined,
  ].filter((dim): dim is { label: string; text: string } => Boolean(dim));

  const sex = dims.find((dim) => dim.label === "Sex")?.text || "";
  const ageGroup = dims.find((dim) => dim.label === "Age Group")?.text || "";

  const commentParts: string[] = [];
  if (unit) commentParts.push(`Unit: ${unit}`);
  for (const dim of dims) {
    commentParts.push(`${dim.label}: ${dim.text}`);
  }

  return {
    IndicatorCode: indicator.IndicatorCode,
    IndicatorName: indicator.IndicatorName || "Unknown Indicator",
    SpatialDimType: item.SpatialDimType || "Country",
    SpatialDim: item.SpatialDim || "Global",
    TimeDim: year,
    TimeDimType: item.TimeDimType || "Year",
    DataSourceDim: item.DataSourceDim || "WHO",
    DataSourceType: item.DataSourceType || "Official",
    Value: formatNumericDisplay(value, unit || undefined),
    NumericValue: value,
    Low: item.Low || item.LowerBound || 0,
    High: item.High || item.UpperBound || 0,
    Comments: commentParts.join(" | ") || "No additional context",
    Date: item.Date || new Date().toISOString(),
    ...(sex ? { Sex: sex } : {}),
    ...(ageGroup ? { AgeGroup: ageGroup } : {}),
  };
}

export function sortWhoValues<T extends { TimeDim?: string | number }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const yearA = parseInt(String(a.TimeDim), 10) || 0;
    const yearB = parseInt(String(b.TimeDim), 10) || 0;
    return yearB - yearA;
  });
}

/** Keep every sex/age slice for the latest year of each indicator. */
export function latestWhoSnapshot<
  T extends { IndicatorCode?: string; TimeDim?: string | number },
>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.IndicatorCode || "";
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const out: T[] = [];
  for (const list of groups.values()) {
    const maxYear = Math.max(
      ...list.map((row) => parseInt(String(row.TimeDim), 10) || 0),
    );
    out.push(
      ...list.filter(
        (row) => (parseInt(String(row.TimeDim), 10) || 0) === maxYear,
      ),
    );
  }
  return out;
}
