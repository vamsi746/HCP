import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Upload, FileText, Move, Pencil, Eye, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import api from "../../services/api";
import { updateCompliance, deleteComplianceDocument, downloadComplianceDocument } from "../../services/endpoints";
import { toast } from "react-hot-toast";

const ComplianceModal = ({ memo, onClose, onSuccess, isOfficer = false, viewOnly = false }) => {
  const [remarks, setRemarks] = useState(memo.complianceRemarks || "");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [removeExistingDoc, setRemoveExistingDoc] = useState(false);

  const isComplied = memo.complianceStatus === "COMPLIED";
  // Submitted compliance is read-only unless officer toggles Edit mode.
  const readOnly = isComplied && !isEditMode;

  // Drag state — modal is centered initially, switches to absolute positioning once user drags
  const [pos, setPos] = useState(null); // { x, y } in px from viewport top-left
  const dragRef = useRef(null);
  const dragState = useRef({ active: false, offsetX: 0, offsetY: 0 });

  const handleMouseDown = (e) => {
    if (!dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    dragState.current = {
      active: true,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };
    if (!pos) setPos({ x: rect.left, y: rect.top });
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragState.current.active) return;
    const x = e.clientX - dragState.current.offsetX;
    const y = e.clientY - dragState.current.offsetY;
    // Keep within viewport bounds
    const maxX = window.innerWidth - 200;
    const maxY = window.innerHeight - 80;
    setPos({
      x: Math.max(-((dragRef.current?.offsetWidth || 0) - 200), Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.active = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarks.trim() && !file) {
      toast.error("Please provide an explanation or upload a document");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (remarks.trim()) formData.append("complianceRemarks", remarks.trim());
      if (file) formData.append("complianceDocument", file);

      await api.put(`/memos/${memo._id}/comply`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast.success("Compliance submitted successfully");
      onSuccess();
    } catch (err) {
      console.error("Compliance submission error:", err);
      toast.error(err.response?.data?.error || "Failed to submit compliance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!remarks.trim() && !file && !memo.complianceDocumentPath) {
      toast.error("Please provide remarks or a document");
      return;
    }
    setIsSubmitting(true);
    try {
      // If user toggled removeExistingDoc and didn't replace, delete first
      if (removeExistingDoc && memo.complianceDocumentPath && !file) {
        await deleteComplianceDocument(memo._id);
      }
      const formData = new FormData();
      if (remarks.trim() !== (memo.complianceRemarks || "")) {
        formData.append("complianceRemarks", remarks.trim());
      }
      if (file) {
        formData.append("complianceDocument", file);
      }
      // Only call PATCH if there's something to send
      if ([...formData.keys()].length > 0) {
        await updateCompliance(memo._id, formData);
      }
      toast.success("Compliance updated successfully");
      onSuccess();
    } catch (err) {
      console.error("Update compliance error:", err);
      toast.error(err.response?.data?.error || "Failed to update compliance");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadDoc = async () => {
    try {
      const res = await downloadComplianceDocument(memo._id);
      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream"
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = memo.complianceDocumentName || "compliance-document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Failed to download document");
    }
  };

  const handlePreviewDoc = async () => {
    try {
      const res = await downloadComplianceDocument(memo._id);
      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream"
      });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("Failed to open document");
    }
  };

  // Use a portal-like high z-index above the dock (which is z-50)
  const overlayStyle = pos
    ? { background: "rgba(0,0,0,0.4)" }
    : { background: "rgba(0,0,0,0.5)" };

  const panelStyle = pos
    ? {
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: "min(1200px, 95vw)",
        height: "90vh"
      }
    : {};

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[200] p-3"
      style={overlayStyle}
      onClick={onClose}
    >
      <div
        ref={dragRef}
        className={`bg-white border border-slate-300 shadow-2xl flex flex-col ${
          pos ? "" : "w-full max-w-[1200px] h-[90vh]"
        }`}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="bg-[#003366] px-5 py-3 flex items-center justify-between flex-shrink-0 border-b-2 border-[#B8860B] cursor-move select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Move size={14} className="text-white/40 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {viewOnly ? "View Issued Memo" : isOfficer ? "Submit Memo Compliance" : "Record Compliance"}
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                Memo No:{" "}
                <span className="font-bold text-white/90 font-mono">
                  {memo.memoNumber || "PENDING"}
                </span>
                <span className="mx-2 text-white/30">|</span>
                Dated:{" "}
                <span className="font-bold text-white/90 tabular-nums">
                  {format(new Date(memo.date), "dd-MM-yyyy")}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-white/60 hover:text-white transition flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Memo preview — A4 width */}
          <div className="flex-1 bg-neutral-200 p-8 overflow-auto border-r border-slate-300 scrollbar-thin">
            <div
              className="bg-white shadow-2xl mx-auto border border-slate-300 mb-8"
              style={{
                width: "210mm",
                minHeight: "297mm",
                padding: "25mm 20mm",
                boxSizing: "border-box",
                position: "relative"
              }}
            >
              <div
                className="memo-preview-content"
                style={{
                  fontSize: "13px",
                  lineHeight: "1.7",
                  color: "#1C2334",
                  fontFamily: "'Times New Roman', Times, serif"
                }}
                dangerouslySetInnerHTML={{ __html: memo.content }}
              />
            </div>
          </div>

          {/* Form panel — hidden in view-only mode */}
          {!viewOnly && (
          <div className="w-[360px] flex flex-col bg-white flex-shrink-0">
            {/* Status banner for complied */}
            {isComplied && (
              <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider bg-emerald-700 text-white">
                    COMPLIED
                  </span>
                  {memo.compliedAt && (
                    <span className="text-[11px] text-emerald-700 font-medium tabular-nums">
                      {format(new Date(memo.compliedAt), "dd-MM-yyyy")}
                    </span>
                  )}
                </div>
                {isOfficer && !isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-white text-[#003366] border border-[#003366]/30 hover:bg-[#003366]/5 transition"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#4A5568] uppercase tracking-wider mb-1.5">
                  Explanation / Remarks
                  {!readOnly && !isComplied && <span className="text-[#9B2C2C] ml-1">*</span>}
                </label>
                {readOnly ? (
                  <p className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 whitespace-pre-wrap min-h-[120px]">
                    {memo.complianceRemarks || (
                      <span className="text-slate-300 italic">No remarks entered</span>
                    )}
                  </p>
                ) : (
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={7}
                    placeholder="Type your explanation here..."
                    className="w-full border border-slate-300 px-3 py-2 text-[13px] focus:outline-none focus:border-[#003366] resize-none placeholder:text-slate-400"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#4A5568] uppercase tracking-wider mb-1.5">
                  Supporting Document{" "}
                  {!isComplied && (
                    <span className="text-slate-400 font-normal normal-case">
                      (optional)
                    </span>
                  )}
                </label>

                {/* Existing uploaded document — show with preview/download (and remove/replace if editing) */}
                {memo.complianceDocumentPath && !file && !removeExistingDoc ? (
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2.5 flex items-center gap-2">
                    <FileText size={16} className="text-[#003366] flex-shrink-0" />
                    <span className="text-[12px] text-slate-700 font-medium truncate flex-1" title={memo.complianceDocumentName}>
                      {memo.complianceDocumentName || "Uploaded Document"}
                    </span>
                    <button
                      onClick={handlePreviewDoc}
                      title="Preview"
                      className="p-1 text-slate-400 hover:text-[#003366] hover:bg-blue-50 rounded transition"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={handleDownloadDoc}
                      title="Download"
                      className="p-1 text-slate-400 hover:text-[#003366] hover:bg-blue-50 rounded transition"
                    >
                      <Download size={14} />
                    </button>
                    {isEditMode && (
                      <button
                        onClick={() => setRemoveExistingDoc(true)}
                        title="Remove"
                        className="p-1 text-slate-400 hover:text-[#9B2C2C] hover:bg-red-50 rounded transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ) : readOnly ? (
                  <p className="text-[12px] text-slate-300 italic bg-slate-50 border border-slate-200 px-3 py-2.5">
                    No document uploaded
                  </p>
                ) : (
                  <>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="comp-file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    <label
                      htmlFor="comp-file"
                      className="border border-dashed border-slate-300 px-3 py-4 text-center bg-slate-50 flex items-center justify-center gap-2 cursor-pointer hover:border-[#003366] hover:bg-slate-100 transition-colors"
                    >
                      {file ? (
                        <>
                          <FileText size={14} className="text-[#003366] flex-shrink-0" />
                          <span className="text-[12px] text-slate-700 font-medium truncate max-w-[180px]">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setFile(null);
                            }}
                            className="text-slate-400 hover:text-[#9B2C2C]"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="text-slate-500" />
                          <span className="text-[12px] font-bold text-[#4A5568] uppercase tracking-wider">
                            {isComplied && isEditMode ? "Replace Document" : "Upload Signed Copy"}
                          </span>
                        </>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      PDF, JPG, PNG or DOC up to 10 MB
                    </p>
                    {isEditMode && removeExistingDoc && !file && (
                      <button
                        onClick={() => setRemoveExistingDoc(false)}
                        className="mt-1.5 text-[10px] font-bold text-[#003366] hover:underline uppercase tracking-wider"
                      >
                        Undo Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex gap-3 flex-shrink-0">
              {/* Submit (new compliance) */}
              {!isComplied && (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 border border-slate-300 bg-white text-slate-700 py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#1B6B46] text-white py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-[#155A38] disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? "Submitting…" : "Submit Compliance"}
                  </button>
                </>
              )}

              {/* Edit mode */}
              {isComplied && isEditMode && (
                <>
                  <button
                    onClick={() => {
                      setIsEditMode(false);
                      setRemarks(memo.complianceRemarks || "");
                      setFile(null);
                      setRemoveExistingDoc(false);
                    }}
                    className="flex-1 border border-slate-300 bg-white text-slate-700 py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#003366] text-white py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-[#004480] disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? "Saving…" : "Save Changes"}
                  </button>
                </>
              )}

              {/* View only (complied, not editing) */}
              {isComplied && !isEditMode && (
                <button
                  onClick={onClose}
                  className="flex-1 border border-slate-300 bg-white text-slate-700 py-2.5 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceModal;
