import React from "react";
import SectionCard from "../../../components/ui/SectionCard";
import {
  formatFieldValue,
  getCombinedQrErrors,
  getQrDebugField,
} from "../suppliersPage.utils";

export default function SupplierQrTool({
  suppliers,
  qrSupplierId,
  setQrSupplierId,
  rawQR,
  setRawQR,
  isTesting,
  qrError,
  qrResult,
  selectedSupplier,
  onParseTest,
}) {
  return (
    <SectionCard className="!p-0 overflow-hidden">
      <div className="p-8 surface-panel rounded-2xl">
        <div className="flex justify-between items-center mb-10">
          <div>
            <span className="eyebrow bg-blue-500/10 text-blue-400">Tools</span>
            <h2 className="text-xl font-bold font-display text-heading">
              QR sample checker
            </h2>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
              {selectedSupplier
                ? `Testing with: ${selectedSupplier.name}`
                : "Select a supplier to begin testing"}
            </p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={onParseTest} noValidate>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <label className="field">
              <span className="field-label">Supplier setup</span>
              <select
                className="input px-10"
                value={qrSupplierId}
                onChange={(event) => setQrSupplierId(event.target.value)}
                disabled={suppliers.length === 0}
                aria-label="Target supplier configuration"
              >
                <option value="">Auto-detect supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name} ({supplier.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="field md:col-span-2">
              <span className="field-label">Paste sample QR</span>
              <div className="relative">
                <input
                  className="input font-mono text-xs pr-20"
                  value={rawQR}
                  onChange={(event) => setRawQR(event.target.value)}
                  placeholder="Paste QR string here..."
                  aria-label="Paste sample QR"
                />
                <button
                  type="submit"
                  disabled={isTesting}
                  className="absolute right-1 top-1 bottom-1 px-4 bg-gold-600/10 text-gold-500 text-[10px] font-bold rounded-lg hover:bg-gold-600/20 transition-all"
                  aria-label="Parse QR string"
                >
                  {isTesting ? "BUSY" : "PARSE"}
                </button>
              </div>
            </label>
          </div>

          {qrError && (
            <p className="text-red-400 text-xs font-bold p-3 bg-red-400/5 rounded-xl border border-red-400/10">
              {qrError}
            </p>
          )}
        </form>

        {qrResult && (
          <div className="mt-10 p-6 surface-panel-soft rounded-2xl panel-border animate-zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 border-b panel-border pb-4">
              <div>
                <h3 className="font-bold text-heading">
                  {getCombinedQrErrors(qrResult.parseResult).length === 0
                  ? "Parse successful"
                  : "Needs review"}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Supplier:{" "}
                  <span className="text-primary font-semibold">
                    {qrResult.supplier?.name || "Unknown supplier"}
                  </span>
                  {" • "}
                  Template:{" "}
                  <span className="text-primary font-semibold">
                    {qrResult.parseResult?.meta?.strategy || "unknown"}
                  </span>
                </p>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                  getCombinedQrErrors(qrResult.parseResult).length === 0
                    ? "bg-green-500/10 text-green-500"
                    : "bg-gold-500/10 text-gold-500"
                }`}
              >
                {getCombinedQrErrors(qrResult.parseResult).length === 0
                  ? "OK"
                  : "REVIEW"}
              </div>
            </div>

            {!qrResult.supplier && (
              <div className="mb-6 rounded-2xl border border-gold-500/10 bg-gold-500/5 p-4 text-sm text-muted">
                Supplier detection did not match a known setup. Salesman can
                still continue with manual completion on mobile.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {[
                ["supplier", "Supplier"],
                ["itemCode", "Item Code"],
                ["grossWeight", "Gross"],
                ["stoneWeight", "Stone"],
                ["netWeight", "Net"],
              ].map(([key, label]) => {
                const fieldValue = getQrDebugField(qrResult?.parseResult, key);
                return (
                  <div key={key}>
                    <div className="text-[8px] uppercase text-muted font-bold mb-1">
                      {label}
                    </div>
                    <div
                      className={`text-sm font-bold ${fieldValue?.parsed ? "text-primary" : "text-muted"}`}
                    >
                      {formatFieldValue(fieldValue)}
                    </div>
                  </div>
                );
              })}
            </div>

            {getCombinedQrErrors(qrResult.parseResult).length > 0 && (
              <div className="bg-gold-500/5 border border-gold-500/10 p-4 rounded-xl">
                <div className="text-[10px] text-gold-600 font-bold uppercase mb-2">
                  Warnings:
                </div>
                <ul className="space-y-1">
                  {getCombinedQrErrors(qrResult.parseResult).map(
                    (item, idx) => (
                      <li key={idx} className="text-xs text-gold-500/80">
                        • <strong className="uppercase">{item.field}:</strong>
                        {item.reason}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
