import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  deleteSupplier,
  getSuppliers,
  testSupplierParse,
} from "../../api/suppliers.api";
import SectionCard from "../../components/ui/SectionCard";
import DeleteSupplierDialog from "./components/DeleteSupplierDialog";

const statusText = (isActive) => (isActive ? "Active" : "Inactive");

const formatFieldValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not parsed";
  }

  if (typeof value === "object" && "parsed" in value) {
    return value.parsed ? String(value.value) : "Not parsed";
  }

  return String(value);
};

const getCombinedQrErrors = (result) => [
  ...((Array.isArray(result?.errors) ? result.errors : []) || []),
  ...((Array.isArray(result?.meta?.parseErrors)
    ? result.meta.parseErrors
    : []) || []),
];

const getQrDebugField = (result, key) => {
  if (!result) {
    return { value: null, parsed: false };
  }

  if (result.fields?.[key]) {
    return result.fields[key];
  }

  if (key === "supplier") {
    const value = result.supplier || result.supplierCode || result.supplierName;
    return value ? { value, parsed: true } : { value: null, parsed: false };
  }

  if (key === "itemCode") {
    const value =
      result.itemCode ??
      result.category ??
      result.meta?.itemCode?.value ??
      null;
    return value ? { value, parsed: true } : { value: null, parsed: false };
  }

  if (key === "grossWeight" || key === "stoneWeight" || key === "netWeight") {
    const value = result[key];
    return value === null || value === undefined
      ? { value: null, parsed: false }
      : { value, parsed: true };
  }

  if (key === "karat") {
    const value = result.karat;
    return value ? { value, parsed: true } : { value: null, parsed: false };
  }

  return { value: null, parsed: false };
};

const SupplierCard = ({ supplier, onEdit, onDelete, deletingId }) => (
  <article
    className={`p-6 surface-panel panel-border rounded-2xl premium-shadow hover:border-gold-600/30 transition-all group ${
      supplier.isActive ? "" : "opacity-60 grayscale"
    }`}
  >
    <div className="flex justify-between items-start mb-6">
      <div>
        <span className="eyebrow">Supplier</span>
        <h3 className="text-xl font-bold font-display text-heading">
          {supplier.name}
        </h3>
      </div>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
          supplier.isActive
            ? "bg-green-500/10 text-green-500"
            : "bg-white/5 text-muted"
        }`}
      >
        {statusText(supplier.isActive)}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="surface-panel-soft p-3 rounded-xl panel-border">
        <div className="text-[10px] uppercase text-muted font-bold mb-1">
          Code
        </div>
        <div className="text-primary font-mono">{supplier.code || "-"}</div>
      </div>
      <div className="surface-panel-soft p-3 rounded-xl panel-border">
        <div className="text-[10px] uppercase text-muted font-bold mb-1">
          Payment
        </div>
        <div className="text-primary font-mono capitalize">
          {supplier.paymentMode || "cash"}
        </div>
      </div>
    </div>

    <div className="space-y-4 mb-8">
      <div>
        <div className="text-[10px] uppercase text-muted font-bold mb-1">
          Categories
        </div>
        <div className="text-xs text-muted line-clamp-2 italic">
          {supplier.categories?.length
            ? supplier.categories.join(", ")
            : "None configured"}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-4 border-t panel-border">
        {Object.entries(supplier.qrMapping?.fieldMap || {})
          .filter(([key]) => key !== "supplierCode")
          .map(([key, val]) => (
            <div key={key} className="text-center">
              <div className="text-[8px] uppercase text-muted font-bold mb-1">
                {key.replace("Weight", "")}
              </div>
              <div className="text-xs font-bold text-gold-500">{val}</div>
            </div>
          ))}
      </div>
    </div>

    <div className="flex gap-2 pt-4 border-t panel-border">
      <button
        type="button"
        className="flex-1 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 rounded-xl transition-all text-on-accent"
        onClick={() => onEdit(supplier)}
        aria-label={`Edit supplier ${supplier.name}`}
      >
        Edit
      </button>
      <button
        type="button"
        className="px-4 py-2 text-xs font-bold text-red-500 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
        onClick={() => onDelete(supplier)}
        disabled={deletingId === supplier._id}
        aria-label={`Delete supplier ${supplier.name}`}
      >
        {deletingId === supplier._id ? "..." : "Delete"}
      </button>
    </div>
  </article>
);

export default function SuppliersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [deletingId, setDeletingId] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [qrSupplierId, setQrSupplierId] = useState("");
  const [rawQR, setRawQR] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrResult, setQrResult] = useState(null);

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      navigate("/suppliers", { replace: true });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    let active = true;

    const loadSuppliers = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await getSuppliers();
        if (!active) return;
        setSuppliers(Array.isArray(response) ? response : []);
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof ApiError
            ? error.error
            : error?.message || "Failed to load suppliers.";
        setErrorMessage(message);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadSuppliers();

    return () => {
      active = false;
    };
  }, [reloadTick, location.pathname]);

  const openAddPage = () => {
    navigate("/suppliers/form");
  };

  const beginEdit = (supplier) => {
    navigate("/suppliers/form", { state: { supplier } });
  };

  const handleDelete = (supplier) => {
    setPendingDelete(supplier);
  };

  const confirmDeleteSupplier = async () => {
    if (!pendingDelete) return;

    setDeletingId(pendingDelete._id);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await deleteSupplier(pendingDelete._id);
      setSuccessMessage(response?.message || `Deleted ${pendingDelete.name}.`);
      setPendingDelete(null);
      setReloadTick((value) => value + 1);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.error
          : error?.message || "Failed to delete supplier.";
      setErrorMessage(message);
    } finally {
      setDeletingId("");
    }
  };

  const handleParseTest = async (event) => {
    event.preventDefault();

    const trimmedRaw = rawQR.trim();
    if (!trimmedRaw) {
      setQrError("Paste a raw QR string before testing.");
      return;
    }

    setIsTesting(true);
    setQrError("");
    setSuccessMessage("");

    try {
      const payload = { raw: trimmedRaw };
      if (qrSupplierId) {
        payload.supplierId = qrSupplierId;
      }

      const result = await testSupplierParse(payload);
      setQrResult(result);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.error
          : error?.message || "QR parsing failed.";
      setQrError(message);
      setQrResult(null);
    } finally {
      setIsTesting(false);
    }
  };

  const selectedSupplier =
    suppliers.find((supplier) => supplier._id === qrSupplierId) || null;

  return (
    <main className="page-shell">
      {/* Page header */}
      <section className="page-hero flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="eyebrow">Inventory Management</span>
          <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight uppercase">
            Suppliers List
          </h1>
          <p className="text-muted mt-2 max-w-xl">
            Manage your suppliers, configure delimiter mappings, and test QR
            parsing to ensure scanning accuracy on the mobile app.
          </p>
        </div>
        <button
          type="button"
          className="primary-luxury-button self-start xl:self-auto text-on-accent"
          onClick={openAddPage}
          aria-label="Add supplier"
        >
          Add Supplier
        </button>
      </section>

      {/* Alerts */}
      {successMessage && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-2xl animate-fade-in duration-300">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex justify-between items-center transition-all">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary"
            onClick={() => setReloadTick((value) => value + 1)}
            aria-label="Retry loading suppliers"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Supplier overview */}
        <SectionCard className="xl:col-span-4">
          <div className="space-y-6">
            <div>
              <span className="eyebrow">Supplier Setup</span>
              <h2 className="text-xl font-bold font-display text-heading">
                Create or edit supplier profiles
              </h2>
              <p className="mt-2 text-muted text-sm">
                Use the dedicated supplier form page to add a supplier, set
                settlement mode, and configure QR mappings without crowding the
                list.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase text-muted font-bold mb-1">
                  Total Suppliers
                </div>
                <div className="text-2xl font-bold text-heading">
                  {suppliers.length}
                </div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase text-muted font-bold mb-1">
                  Settlement
                </div>
                <div className="text-2xl font-bold text-heading">
                  Cash / Credit
                </div>
              </div>
            </div>

            <button
              type="button"
              className="primary-luxury-button w-full text-on-accent"
              onClick={openAddPage}
              aria-label="Add supplier from overview"
            >
              Add Supplier
            </button>

            <ul className="space-y-3 text-sm text-muted leading-relaxed">
              <li>• Edit suppliers from the card actions on the right.</li>
              <li>• Credit settlement is available for supplier accounts.</li>
              <li>• Legacy delimiter mappings remain supported.</li>
            </ul>
          </div>
        </SectionCard>

        {/* Supplier cards and QR tools */}
        <section className="xl:col-span-8 space-y-8">
          {/* Supplier cards */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold font-display text-heading">
                Active Suppliers
              </h2>
              <p className="text-xs text-muted uppercase tracking-widest font-bold mt-1">
                {isLoading ? "Loading..." : `${suppliers.length} Records Found`}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-muted hover:text-primary transition-colors"
              onClick={() => setReloadTick((value) => value + 1)}
              aria-label="Refresh supplier data"
            >
              Refresh Data
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-40">
              <div className="h-64 surface-panel rounded-2xl animate-pulse" />
              <div className="h-64 surface-panel rounded-2xl animate-pulse" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="glass-panel p-20 text-center border-dashed panel-border">
              <div className="text-3xl mb-4 text-heading">+</div>
              <h3 className="text-lg font-bold mb-2 text-heading">
                No Suppliers Found
              </h3>
              <p className="text-sm text-muted">
                Add a supplier to configure QR parsing rules.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier._id}
                  supplier={supplier}
                  onEdit={beginEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>
          )}

          {/* QR test tool */}
          <SectionCard className="!p-0 overflow-hidden">
            <div className="p-8 surface-panel rounded-2xl">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <span className="eyebrow bg-blue-500/10 text-blue-400">
                    Tools
                  </span>
                  <h2 className="text-xl font-bold font-display text-heading">
                    QR Test Tool
                  </h2>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
                    {selectedSupplier
                      ? `Testing with: ${selectedSupplier.name}`
                      : "Select a supplier to begin testing"}
                  </p>
                </div>
              </div>

              <form className="space-y-6" onSubmit={handleParseTest} noValidate>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <label className="field">
                    <span className="field-label">Target Config</span>
                    <select
                      className="input"
                      value={qrSupplierId}
                      onChange={(event) => setQrSupplierId(event.target.value)}
                      disabled={suppliers.length === 0}
                      aria-label="Target supplier configuration"
                    >
                      <option value="">Auto-detect Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier._id} value={supplier._id}>
                          {supplier.name} ({supplier.code})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field md:col-span-2">
                    <span className="field-label">Raw QR Capture</span>
                    <div className="relative">
                      <input
                        className="input font-mono text-xs pr-20"
                        value={rawQR}
                        onChange={(event) => setRawQR(event.target.value)}
                        placeholder="Paste QR string here..."
                        aria-label="Raw QR capture"
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
                          ? "Parse Successful"
                          : "Validation Warn"}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        Supplier:{' '}
                        <span className="text-primary font-semibold">
                          {qrResult.supplier?.name || 'Unknown supplier'}
                        </span>
                        {' • '}
                        Strategy:{' '}
                        <span className="text-primary font-semibold">
                          {qrResult.parseResult?.meta?.strategy || 'unknown'}
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
                        ? "TRUSTED"
                        : "MANUAL CHECK"}
                    </div>
                  </div>

                  {!qrResult.supplier && (
                    <div className="mb-6 rounded-2xl border border-gold-500/10 bg-gold-500/5 p-4 text-sm text-muted">
                      Supplier detection did not match a known configuration. Salesman can still continue with manual completion on mobile.
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
                      const fieldValue = getQrDebugField(
                        qrResult?.parseResult,
                        key,
                      );
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
                        Logic Inconsistencies:
                      </div>
                      <ul className="space-y-1">
                        {getCombinedQrErrors(qrResult.parseResult).map(
                          (item, idx) => (
                            <li key={idx} className="text-xs text-gold-500/80">
                              • 
                              <strong className="uppercase">
                                {item.field}:
                              </strong>{" "}
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
        </section>
      </div>

      <DeleteSupplierDialog
        open={Boolean(pendingDelete)}
        supplierName={pendingDelete?.name}
        isDeleting={Boolean(deletingId)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteSupplier}
      />
    </main>
  );
}
