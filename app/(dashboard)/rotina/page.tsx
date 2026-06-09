"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  carregarPainelGeralAction, carregarRotinaAction,
  criarListaAction, editarListaAction, excluirListaAction,
  criarCartaoAction, editarCartaoAction, excluirCartaoAction, moverCartaoAction,
  reordenarListasAction, reordenarCartoesAction, listarVendedoresParaKanbanAction,
  carregarComentariosAction, criarComentarioAction, excluirComentarioAction,
} from "@/lib/actions/kanban";

// ── Tipos ──────────────────────────────────────────────────

interface Seller { id: string; name: string; avatar: string | null; }
interface KanbanList { id: string; title: string; position: number; color: string; }
interface KanbanCard {
  id: string; list_id: string; title: string; description: string | null;
  position: number; due_date: string | null; priority: string; assigned_to: string | null;
}
interface Comment {
  id: string; card_id: string; author_id: string; content: string; created_at: string;
  author: { name: string; avatar: string | null };
}

// "meu"      → board próprio do usuário (vendedor ou admin)
// "geral"    → board compartilhado do admin (todos podem ver, vendedores podem criar cartões)
// "vendedor" → admin visualiza/gerencia board de um vendedor específico
type Mode = "meu" | "geral" | "vendedor";

// ── Helpers ────────────────────────────────────────────────

const LIST_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  violet:  { bg: "bg-violet-500",  text: "text-violet-400",  ring: "ring-violet-500"  },
  blue:    { bg: "bg-blue-500",    text: "text-blue-400",    ring: "ring-blue-500"    },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-400", ring: "ring-emerald-500" },
  yellow:  { bg: "bg-yellow-400",  text: "text-yellow-400",  ring: "ring-yellow-400"  },
  orange:  { bg: "bg-orange-500",  text: "text-orange-400",  ring: "ring-orange-500"  },
  red:     { bg: "bg-red-500",     text: "text-red-400",     ring: "ring-red-500"     },
  pink:    { bg: "bg-pink-500",    text: "text-pink-400",    ring: "ring-pink-500"    },
  cyan:    { bg: "bg-cyan-500",    text: "text-cyan-400",    ring: "ring-cyan-500"    },
};

const PRIORITY_CFG: Record<string, { color: string; bg: string }> = {
  Alta:   { color: "text-red-400",     bg: "bg-red-500/20 border-red-500/40"      },
  Normal: { color: "text-blue-400",    bg: "bg-blue-500/20 border-blue-500/40"    },
  Baixa:  { color: "text-neutral-400", bg: "bg-neutral-700/60 border-neutral-600" },
};

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}`;
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function isOverdue(d: string) {
  const t = new Date(); t.setHours(0,0,0,0);
  return new Date(d + "T00:00:00") < t;
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

// ── Seletor de Cor ─────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Cor da lista</label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(LIST_COLORS).map(([key, cfg]) => (
          <button key={key} type="button" onClick={() => onChange(key)}
            className={cn("w-7 h-7 rounded-full transition-all", cfg.bg,
              value === key ? `ring-2 ${cfg.ring} ring-offset-2 ring-offset-neutral-900 scale-110` : "opacity-60 hover:opacity-100 hover:scale-105"
            )} />
        ))}
      </div>
    </div>
  );
}

// ── Drawer de Detalhes do Cartão ───────────────────────────

function CardDrawer({
  card, lists, sellers, canEdit, onClose, onSave,
}: {
  card: KanbanCard; lists: KanbanList[]; sellers: Seller[];
  canEdit: boolean; onClose: () => void; onSave: (updated: KanbanCard) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description ?? "");
  const [priority, setPriority] = useState(card.priority);
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [assignedTo, setAssignedTo] = useState(card.assigned_to ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    const load = async () => {
      setCommentsLoading(true);
      const data = await carregarComentariosAction(card.id);
      setComments(data as Comment[]);
      setCommentsLoading(false);
    };
    load();
  }, [card.id]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(null);
    const res = await editarCartaoAction(
      card.id, title, desc, priority, dueDate,
      assignedTo || undefined, card.assigned_to || undefined,
    );
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    onSave({ ...card, title: title.trim(), description: desc.trim() || null, priority, due_date: dueDate || null, assigned_to: assignedTo || null });
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSendingComment(true);
    await criarComentarioAction(card.id, newComment);
    const data = await carregarComentariosAction(card.id);
    setComments(data as Comment[]);
    setNewComment("");
    setSendingComment(false);
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleDeleteComment = async (commentId: string) => {
    await excluirComentarioAction(commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const list = lists.find(l => l.id === card.list_id);
  const lc = list ? (LIST_COLORS[list.color] ?? LIST_COLORS.violet) : LIST_COLORS.violet;
  const assignedSeller = assignedTo ? sellers.find(s => s.id === assignedTo) : null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] bg-neutral-950 border-l border-white/10 flex flex-col shadow-2xl"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 flex-shrink-0">
          {list && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", lc.bg)} />
              <span className={cn("text-xs font-bold truncate", lc.text)}>{list.title}</span>
            </div>
          )}
          <button type="button" onClick={onClose}
            className="ml-auto p-2 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors flex-shrink-0">
            <Icon icon="line-md:close" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {canEdit ? (
              <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2}
                className="w-full bg-transparent text-xl font-black text-white resize-none outline-none focus:bg-white/5 rounded-xl px-2 py-1 -mx-2 transition-all border border-transparent focus:border-white/10"
              />
            ) : (
              <h2 className="text-xl font-black text-white leading-snug px-2">{card.title}</h2>
            )}

            <div className="grid grid-cols-2 gap-3">
              {canEdit && sellers.length > 0 ? (
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <Icon icon="mdi:account" className="h-3 w-3" /> Responsável
                  </label>
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 cursor-pointer transition-all">
                    <option value="">Nenhum</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              ) : assignedSeller ? (
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <Icon icon="mdi:account" className="h-3 w-3" /> Responsável
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                    <span className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-[9px] font-black text-white flex-shrink-0">
                      {initials(assignedSeller.name)}
                    </span>
                    <span className="text-sm text-violet-300 font-semibold truncate">{assignedSeller.name.split(" ")[0]}</span>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 flex items-center gap-1.5">
                  <Icon icon="mdi:calendar" className="h-3 w-3" /> Prazo
                </label>
                {canEdit ? (
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 [color-scheme:dark] transition-all"
                  />
                ) : card.due_date ? (
                  <div className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold",
                    isOverdue(card.due_date) ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-neutral-800 border-white/10 text-neutral-300"
                  )}>
                    {fmtDate(card.due_date)}{isOverdue(card.due_date) && " — Atrasado"}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-neutral-600">Sem prazo</div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Prioridade</label>
              <div className="flex gap-2">
                {(["Baixa", "Normal", "Alta"] as const).map(p => {
                  const cfg = PRIORITY_CFG[p];
                  const active = priority === p;
                  return (
                    <button key={p} type="button"
                      onClick={() => canEdit && setPriority(p)}
                      className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                        active ? cn(cfg.bg, cfg.color) : "bg-transparent border-white/10 text-neutral-500",
                        canEdit && !active && "hover:border-white/20 cursor-pointer",
                        !canEdit && "cursor-default"
                      )}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Descrição</label>
              {canEdit ? (
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Adicione uma descrição detalhada..." rows={4}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder:text-neutral-600 resize-none transition-all"
                />
              ) : (
                <div className="bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 min-h-[80px]">
                  {card.description
                    ? <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{card.description}</p>
                    : <p className="text-sm text-neutral-600 italic">Sem descrição</p>
                  }
                </div>
              )}
            </div>

            {canEdit && (
              <div className="space-y-2">
                {saveError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{saveError}</p>
                )}
                <button type="button" onClick={handleSave} disabled={saving || !title.trim()}
                  className="w-full bg-white text-black py-2.5 rounded-xl text-sm font-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Icon icon="line-md:loading-loop" className="h-4 w-4" /> : "Salvar alterações"}
                </button>
              </div>
            )}

            <div className="border-t border-white/5" />

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-neutral-500 flex items-center gap-1.5">
                <Icon icon="mdi:comment-multiple-outline" className="h-3.5 w-3.5" />
                Comentários
                {comments.length > 0 && <span className="text-neutral-600">({comments.length})</span>}
              </h4>

              <div className="flex gap-2">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Escreva um comentário... (Enter para enviar)" rows={2}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 placeholder:text-neutral-600 resize-none transition-all"
                />
                <button type="button" onClick={handleSendComment}
                  disabled={sendingComment || !newComment.trim()}
                  className="px-3 bg-violet-500 rounded-xl text-white hover:bg-violet-600 disabled:opacity-40 transition-colors flex items-center justify-center">
                  {sendingComment ? <Icon icon="line-md:loading-loop" className="h-4 w-4" /> : <Icon icon="mdi:send" className="h-4 w-4" />}
                </button>
              </div>

              {commentsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Icon icon="line-md:loading-loop" className="h-5 w-5 text-neutral-600" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-sm text-neutral-600 py-4">Nenhum comentário ainda</p>
              ) : (
                <div className="space-y-4">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3 group">
                      <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5">
                        {initials(c.author.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-bold text-white">{c.author.name}</span>
                          <span className="text-[10px] text-neutral-600">{fmtDateTime(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-neutral-300 leading-relaxed break-words whitespace-pre-wrap">{c.content}</p>
                      </div>
                      {canEdit && (
                        <button type="button" onClick={() => handleDeleteComment(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all flex-shrink-0 mt-0.5">
                          <Icon icon="mdi:trash-can" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Cartão Sortável ────────────────────────────────────────

function CardItem({
  card, lists, sellers, canEdit, onDelete, onMove, onOpen,
}: {
  card: KanbanCard; lists: KanbanList[]; sellers: Seller[]; canEdit: boolean;
  onDelete: (cardId: string) => void;
  onMove: (cardId: string, listId: string) => void;
  onOpen: (card: KanbanCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: !canEdit });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pri = PRIORITY_CFG[card.priority] ?? PRIORITY_CFG.Normal;
  const overdue = card.due_date && isOverdue(card.due_date);
  const assignedSeller = card.assigned_to ? sellers.find(s => s.id === card.assigned_to) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="bg-neutral-800 border border-white/10 rounded-xl p-3 shadow-sm hover:border-white/20 transition-colors group"
    >
      <div className="flex items-start gap-1.5">
        {canEdit && (
          <div {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors mt-0.5 flex-shrink-0 touch-none">
            <Icon icon="mdi:drag-vertical" className="h-4 w-4" />
          </div>
        )}

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(card)}>
          <p className="text-sm font-semibold text-white leading-snug">{card.title}</p>
          {card.description && (
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed line-clamp-2">{card.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            {card.priority !== "Normal" && (
              <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border", pri.bg, pri.color)}>
                <Icon icon="mdi:flag" className="h-2.5 w-2.5" />{card.priority}
              </span>
            )}
            {card.due_date && (
              <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border",
                overdue ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-neutral-700/60 border-neutral-600 text-neutral-400"
              )}>
                <Icon icon="mdi:calendar" className="h-2.5 w-2.5" />
                {fmtDate(card.due_date)}{overdue && " ✕"}
              </span>
            )}
            {assignedSeller && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-violet-500/15 border-violet-500/30 text-violet-300">
                <span className="w-3.5 h-3.5 rounded-full bg-violet-500 flex items-center justify-center text-[8px] font-black text-white flex-shrink-0">
                  {initials(assignedSeller.name)}
                </span>
                {assignedSeller.name.split(" ")[0]}
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button type="button" onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 rounded text-neutral-600 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
              <Icon icon="mdi:dots-horizontal" className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 top-7 w-44 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-1 z-20 overflow-hidden">
                  {lists.filter(l => l.id !== card.list_id).map(l => {
                    const lc = LIST_COLORS[l.color] ?? LIST_COLORS.violet;
                    return (
                      <button key={l.id} type="button" onClick={() => { setMenuOpen(false); onMove(card.id, l.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-400 hover:bg-white/10 hover:text-white transition-colors truncate">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", lc.bg)} />
                        <span className="truncate">Mover p/ {l.title}</span>
                      </button>
                    );
                  })}
                  <div className="border-t border-white/5 mt-1 pt-1">
                    <button type="button" onClick={() => { setMenuOpen(false); onDelete(card.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
                      <Icon icon="mdi:trash-can" className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Coluna ─────────────────────────────────────────────────

function KanbanColumn({
  list, cards, lists, sellers, canEdit, canAddCard,
  onAddCard, onEditList, onDeleteList, onDeleteCard, onMoveCard, onOpenCard,
}: {
  list: KanbanList; cards: KanbanCard[]; lists: KanbanList[]; sellers: Seller[];
  canEdit: boolean;
  canAddCard: boolean;
  onAddCard: (listId: string) => void;
  onEditList: (list: KanbanList) => void;
  onDeleteList: (listId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onMoveCard: (cardId: string, listId: string) => void;
  onOpenCard: (card: KanbanCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id, disabled: !canEdit });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lc = LIST_COLORS[list.color] ?? LIST_COLORS.violet;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex-shrink-0 w-72 flex flex-col bg-neutral-900/80 border border-white/10 rounded-2xl overflow-hidden">
      <div className={cn("h-1 w-full", lc.bg)} />
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {canEdit && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors touch-none">
              <Icon icon="mdi:drag-vertical" className="h-4 w-4" />
            </div>
          )}
          <h3 className={cn("font-black text-sm truncate", lc.text)}>{list.title}</h3>
          <span className="text-[10px] font-bold text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded-full flex-shrink-0">{cards.length}</span>
        </div>
        {canEdit && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-neutral-600 hover:text-white hover:bg-white/10 transition-colors">
              <Icon icon="mdi:dots-horizontal" className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 top-8 w-44 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-1 z-20 overflow-hidden">
                  <button type="button" onClick={() => { setMenuOpen(false); onEditList(list); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-colors">
                    <Icon icon="mdi:pencil" className="h-3.5 w-3.5" /> Renomear lista
                  </button>
                  <div className="border-t border-white/5 mt-1 pt-1">
                    <button type="button" onClick={() => { setMenuOpen(false); onDeleteList(list.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
                      <Icon icon="mdi:trash-can" className="h-3.5 w-3.5" /> Excluir lista
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-310px)]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <CardItem key={card.id} card={card} lists={lists} sellers={sellers} canEdit={canEdit}
              onDelete={onDeleteCard} onMove={onMoveCard} onOpen={onOpenCard} />
          ))}
        </SortableContext>
      </div>

      {(canEdit || canAddCard) && (
        <button type="button" onClick={() => onAddCard(list.id)}
          className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5">
          <Icon icon="mdi:plus" className="h-4 w-4" /> Adicionar cartão
        </button>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────

function Modal({
  isOpen, title, onClose, onConfirm, loading, error, children,
}: {
  isOpen: boolean; title: string; onClose: () => void; onConfirm: () => void;
  loading?: boolean; error?: string | null; children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6 border border-white/20 bg-neutral-900 text-white space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-colors">
            <Icon icon="line-md:close" className="h-4 w-4" />
          </button>
        </div>
        {children}
        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-[2] bg-white text-black py-2.5 rounded-xl text-sm font-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Icon icon="line-md:loading-loop" className="h-4 w-4" /> : "Confirmar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Página Principal ───────────────────────────────────────

export default function RotinaPage() {
  const [lists, setLists] = useState<KanbanList[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  // "meu" = board próprio (default para vendedor), "geral" = board do admin (default para admin), "vendedor" = admin gerencia vendedor
  const [mode, setMode] = useState<Mode>("meu");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminBoardId, setAdminBoardId] = useState<string | undefined>(undefined);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | undefined>(undefined);

  const [drawerCard, setDrawerCard] = useState<KanbanCard | null>(null);

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);

  const [modal, setModal] = useState<{
    type: "addList" | "editList" | "addCard" | "deleteList" | "deleteCard" | null;
    listId?: string; card?: KanbanCard; list?: KanbanList;
  }>({ type: null });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [inputTitle, setInputTitle] = useState("");
  const [inputDesc, setInputDesc] = useState("");
  const [inputColor, setInputColor] = useState("violet");
  const [inputPriority, setInputPriority] = useState("Normal");
  const [inputDueDate, setInputDueDate] = useState("");
  const [inputAssignedTo, setInputAssignedTo] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Pode gerenciar listas, arrastar, deletar cartões
  const canEdit = isAdmin || mode === "meu";
  // Pode adicionar cartões (vendedor no painel geral também pode)
  const canAddCard = canEdit || (!isAdmin && mode === "geral");

  // targetSellerId para criação:
  // - admin no modo vendedor → board do vendedor selecionado
  // - vendedor no modo geral → board do admin (para criar cartão lá)
  // - demais → undefined (usa o próprio userId)
  const createTargetId =
    mode === "vendedor" ? selectedSellerId :
    (!isAdmin && mode === "geral") ? adminBoardId :
    undefined;

  const carregarDados = useCallback(async (sellerId?: string) => {
    const data = await carregarRotinaAction(sellerId);
    setLists(data.lists as KanbanList[]);
    setCards(data.cards as KanbanCard[]);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Sempre chama para descobrir isAdmin e adminId
      const info = await carregarPainelGeralAction();
      setIsAdmin(info.isAdmin);
      setAdminBoardId(info.adminId ?? undefined);

      if (info.isAdmin) {
        // Admin começa no PAINEL GERAL com seu próprio board
        setMode("geral");
        setLists(info.lists as KanbanList[]);
        setCards(info.cards as KanbanCard[]);
        const sellerList = await listarVendedoresParaKanbanAction();
        setSellers(sellerList as Seller[]);
      } else {
        // Vendedor começa no MEU PAINEL com seu próprio board
        setMode("meu");
        const myBoard = await carregarRotinaAction();
        setLists(myBoard.lists as KanbanList[]);
        setCards(myBoard.cards as KanbanCard[]);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleModeChange = async (newMode: Mode) => {
    if (newMode === mode && newMode !== "vendedor") return;
    setMode(newMode);
    setSelectedSellerId(undefined);
    setDrawerCard(null);
    setLoading(true);

    if (newMode === "geral") {
      const info = await carregarPainelGeralAction();
      setLists(info.lists as KanbanList[]);
      setCards(info.cards as KanbanCard[]);
    } else if (newMode === "meu") {
      await carregarDados(); // carrega board do próprio usuário
    } else {
      // vendedor: espera seleção
      setLists([]);
      setCards([]);
    }
    setLoading(false);
  };

  const handleSellerChange = async (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setDrawerCard(null);
    setLoading(true);
    await carregarDados(sellerId);
    setLoading(false);
  };

  // NOVA LISTA para vendedor: sempre cria no MEU PAINEL
  const handleNovaLista = () => {
    if (!isAdmin && mode !== "meu") {
      // Muda para meu painel e abre modal
      setDrawerCard(null);
      setLoading(true);
      carregarDados().then(() => setLoading(false));
      setMode("meu");
    }
    openModal("addList");
  };

  const openModal = (type: typeof modal.type, opts?: { listId?: string; card?: KanbanCard; list?: KanbanList }) => {
    setModalError(null);
    setInputTitle(type === "editList" ? (opts?.list?.title ?? "") : "");
    setInputDesc("");
    setInputColor(type === "editList" ? (opts?.list?.color ?? "violet") : "violet");
    setInputPriority("Normal");
    setInputDueDate("");
    setInputAssignedTo(type === "addCard" ? (createTargetId ?? "") : "");
    setModal({ type, ...opts });
  };

  const closeModal = () => { setModal({ type: null }); setModalError(null); };

  const recarregar = useCallback(async () => {
    if (mode === "geral") {
      const info = await carregarPainelGeralAction();
      setLists(info.lists as KanbanList[]);
      setCards(info.cards as KanbanCard[]);
    } else if (mode === "meu") {
      await carregarDados();
    } else if (mode === "vendedor" && selectedSellerId) {
      await carregarDados(selectedSellerId);
    }
  }, [mode, selectedSellerId, carregarDados]);

  const handleConfirm = async () => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (modal.type === "addList") {
        if (!inputTitle.trim()) { setModalError("Digite um título para a lista."); return; }
        // Lista sempre criada no board correto (undefined = próprio usuário)
        const listTarget = isAdmin ? createTargetId : undefined;
        const res = await criarListaAction(inputTitle, inputColor, listTarget);
        if (res.error) { setModalError(res.error); return; }
        await recarregar();

      } else if (modal.type === "editList" && modal.list) {
        if (!inputTitle.trim()) { setModalError("Digite um título."); return; }
        const res = await editarListaAction(modal.list.id, inputTitle, inputColor);
        if (res.error) { setModalError(res.error); return; }
        await recarregar();

      } else if (modal.type === "deleteList" && modal.list) {
        const res = await excluirListaAction(modal.list.id);
        if (res.error) { setModalError(res.error); return; }
        setDrawerCard(null);
        await recarregar();

      } else if (modal.type === "addCard" && modal.listId) {
        if (!inputTitle.trim()) { setModalError("Digite um título para o cartão."); return; }
        const res = await criarCartaoAction(modal.listId, inputTitle, inputDesc, inputPriority, inputDueDate, inputAssignedTo || undefined, createTargetId);
        if (res.error) { setModalError(res.error); return; }
        await recarregar();

      } else if (modal.type === "deleteCard" && modal.card) {
        const res = await excluirCartaoAction(modal.card.id);
        if (res.error) { setModalError(res.error); return; }
        if (drawerCard?.id === modal.card.id) setDrawerCard(null);
        await recarregar();
      }

      closeModal();
    } finally {
      setModalLoading(false);
    }
  };

  const handleMoveCard = async (cardId: string, newListId: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, list_id: newListId } : c));
    if (drawerCard?.id === cardId) setDrawerCard(prev => prev ? { ...prev, list_id: newListId } : null);
    await moverCartaoAction(cardId, newListId);
  };

  const handleDrawerSave = (updated: KanbanCard) => {
    setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    setDrawerCard(updated);
  };

  // ── DnD ──────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (lists.some(l => l.id === id)) setActiveListId(id);
    else setActiveCardId(id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeCardId) {
      const activeCard = cards.find(c => c.id === activeId);
      if (!activeCard) return;
      const targetListId = lists.some(l => l.id === overId) ? overId : cards.find(c => c.id === overId)?.list_id;
      if (targetListId && targetListId !== activeCard.list_id) {
        setOverListId(targetListId);
        setCards(prev => prev.map(c => c.id === activeId ? { ...c, list_id: targetListId } : c));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) { setActiveListId(null); setActiveCardId(null); setOverListId(null); return; }
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeListId) {
      const oldIdx = lists.findIndex(l => l.id === activeId);
      const newIdx = lists.findIndex(l => l.id === overId);
      if (oldIdx !== newIdx) {
        const reordered = arrayMove(lists, oldIdx, newIdx);
        setLists(reordered);
        await reordenarListasAction(reordered.map(l => l.id));
      }
    } else if (activeCardId) {
      const activeCard = cards.find(c => c.id === activeId);
      if (!activeCard) return;
      const finalListId = overListId || activeCard.list_id;
      const listCards = cards.filter(c => c.list_id === finalListId);
      const oldIdx = listCards.findIndex(c => c.id === activeId);
      const overCard = cards.find(c => c.id === overId);
      const newIdx = overCard ? listCards.findIndex(c => c.id === overId) : listCards.length - 1;
      if (oldIdx !== newIdx || overListId) {
        const reordered = arrayMove(listCards, oldIdx, newIdx < 0 ? listCards.length - 1 : newIdx);
        const otherCards = cards.filter(c => c.list_id !== finalListId && c.id !== activeId);
        setCards([...otherCards, ...reordered]);
        if (overListId) await moverCartaoAction(activeId, finalListId);
        await reordenarCartoesAction(reordered.map(c => c.id), finalListId);
      }
    }
    setActiveListId(null); setActiveCardId(null); setOverListId(null);
  };

  const activeCard = activeCardId ? cards.find(c => c.id === activeCardId) : null;
  const activeList = activeListId ? lists.find(l => l.id === activeListId) : null;

  const modalTitle =
    modal.type === "addList"    ? "Nova Lista"    :
    modal.type === "editList"   ? "Editar Lista"  :
    modal.type === "deleteList" ? "Excluir Lista" :
    modal.type === "addCard"    ? "Novo Cartão"   : "Excluir Cartão";

  const showEmptyVendedor = mode === "vendedor" && !selectedSellerId;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">

      {/* Header */}
      <header className="mb-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Icon icon="mdi:view-column" className="h-8 w-8 text-violet-400" />
              Rotina
            </h2>
            <p className="text-neutral-400 mt-0.5 text-sm">Organize tarefas e rotinas da equipe</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botões de modo */}
            <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1 gap-1">
              {!isAdmin ? (
                // Vendedor: MEU PAINEL + PAINEL GERAL
                <>
                  <button type="button" onClick={() => handleModeChange("meu")}
                    className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                      mode === "meu" ? "bg-white text-black shadow" : "text-neutral-400 hover:text-white"
                    )}>
                    <Icon icon="mdi:account-circle" className="h-3.5 w-3.5" />
                    MEU PAINEL
                  </button>
                  <button type="button" onClick={() => handleModeChange("geral")}
                    className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                      mode === "geral" ? "bg-violet-500 text-white shadow" : "text-neutral-400 hover:text-white"
                    )}>
                    <Icon icon="mdi:view-grid" className="h-3.5 w-3.5" />
                    PAINEL GERAL
                  </button>
                </>
              ) : (
                // Admin: PAINEL GERAL + PAINEL VENDEDOR
                <>
                  <button type="button" onClick={() => handleModeChange("geral")}
                    className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                      mode === "geral" ? "bg-white text-black shadow" : "text-neutral-400 hover:text-white"
                    )}>
                    <Icon icon="mdi:view-grid" className="h-3.5 w-3.5" />
                    PAINEL GERAL
                  </button>
                  <button type="button" onClick={() => handleModeChange("vendedor")}
                    className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                      mode === "vendedor" ? "bg-violet-500 text-white shadow" : "text-neutral-400 hover:text-white"
                    )}>
                    <Icon icon="mdi:account-group" className="h-3.5 w-3.5" />
                    PAINEL VENDEDOR
                  </button>
                </>
              )}
            </div>

            {/* NOVA LISTA:
                - Vendedor: sempre visível, cria no MEU PAINEL
                - Admin: visível no geral ou vendedor com seller selecionado */}
            {(!isAdmin || (mode === "geral" || (mode === "vendedor" && selectedSellerId))) && (
              <button type="button" onClick={handleNovaLista}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:bg-neutral-200 hover:scale-105">
                <Icon icon="mdi:plus" className="h-4 w-4" /> Nova Lista
              </button>
            )}
          </div>
        </div>

        {/* Sub-header: modo vendedor (admin) */}
        <AnimatePresence>
          {mode === "vendedor" && isAdmin && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <Icon icon="mdi:account-search" className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <span className="text-xs font-bold text-violet-300 flex-shrink-0">Vendedor:</span>
                <select value={selectedSellerId ?? ""}
                  onChange={e => e.target.value && handleSellerChange(e.target.value)}
                  className="flex-1 bg-transparent border border-violet-500/30 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-400 transition-all cursor-pointer">
                  <option value="">Selecione um vendedor...</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {selectedSellerId && (
                  <button type="button" onClick={() => { setSelectedSellerId(undefined); setLists([]); setCards([]); }}
                    className="text-violet-400 hover:text-white transition-colors flex-shrink-0">
                    <Icon icon="line-md:close" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-header: modo geral para vendedor — aviso de somente leitura parcial */}
        <AnimatePresence>
          {!isAdmin && mode === "geral" && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Icon icon="mdi:information-outline" className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-300">Você está vendo o painel da equipe. Pode adicionar cartões às listas existentes.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-72 h-64 bg-neutral-900/80 border border-white/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : showEmptyVendedor ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
          <Icon icon="mdi:account-arrow-left" className="h-16 w-16 text-neutral-700 mb-4" />
          <h3 className="text-lg font-black text-white mb-2">Selecione um vendedor</h3>
          <p className="text-neutral-400 text-sm max-w-xs">Escolha um vendedor no seletor acima para ver e gerenciar as tarefas dele</p>
        </motion.div>
      ) : lists.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
          <Icon icon="mdi:view-column-outline" className="h-20 w-20 text-neutral-700 mb-4" />
          <h3 className="text-xl font-black text-white mb-2">Nenhuma lista ainda</h3>
          <p className="text-neutral-400 text-sm mb-6 max-w-xs">
            {canEdit
              ? "Crie a primeira lista para começar a organizar"
              : "Nenhuma lista foi criada neste painel ainda"}
          </p>
          {canEdit && (
            <button type="button" onClick={() => openModal("addList")}
              className="flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-3 text-sm font-bold text-white hover:bg-violet-600 transition-colors">
              <Icon icon="mdi:plus" className="h-5 w-5" /> Criar primeira lista
            </button>
          )}
        </motion.div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
            <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map(list => (
                <KanbanColumn key={list.id} list={list}
                  cards={cards.filter(c => c.list_id === list.id).sort((a, b) => a.position - b.position)}
                  lists={lists} sellers={sellers} canEdit={canEdit} canAddCard={canAddCard}
                  onAddCard={(listId) => openModal("addCard", { listId })}
                  onEditList={(l) => openModal("editList", { list: l })}
                  onDeleteList={(listId) => openModal("deleteList", { list: lists.find(l => l.id === listId) })}
                  onDeleteCard={(cardId) => openModal("deleteCard", { card: cards.find(c => c.id === cardId) })}
                  onMoveCard={handleMoveCard}
                  onOpenCard={setDrawerCard}
                />
              ))}
            </SortableContext>
            {canEdit && (
              <button type="button" onClick={() => openModal("addList")}
                className="flex-shrink-0 w-72 flex items-center gap-2 px-4 py-4 text-sm font-bold text-neutral-500 hover:text-white border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl transition-all">
                <Icon icon="mdi:plus" className="h-5 w-5" /> Nova lista
              </button>
            )}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="bg-neutral-800 border border-violet-500/40 rounded-xl p-3 shadow-2xl rotate-2 w-72">
                <p className="text-sm font-semibold text-white">{activeCard.title}</p>
                {activeCard.description && <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{activeCard.description}</p>}
              </div>
            )}
            {activeList && (
              <div className="w-72 bg-neutral-900/90 border border-violet-500/40 rounded-2xl p-4 shadow-2xl rotate-1">
                <p className="text-sm font-black text-white">{activeList.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Drawer de detalhes do cartão */}
      <AnimatePresence>
        {drawerCard && (
          <CardDrawer
            key={drawerCard.id}
            card={drawerCard}
            lists={lists}
            sellers={sellers}
            canEdit={canEdit}
            onClose={() => setDrawerCard(null)}
            onSave={handleDrawerSave}
          />
        )}
      </AnimatePresence>

      {/* Modais */}
      <AnimatePresence>
        {modal.type && (
          <Modal isOpen title={modalTitle} onClose={closeModal} onConfirm={handleConfirm}
            loading={modalLoading} error={modalError}>
            {(modal.type === "deleteList" || modal.type === "deleteCard") ? (
              <p className="text-sm text-neutral-400">
                {modal.type === "deleteList"
                  ? `Excluir a lista "${modal.list?.title}" e todos os seus cartões?`
                  : `Excluir o cartão "${modal.card?.title}"?`}
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Título</label>
                  <input autoFocus type="text" value={inputTitle} onChange={e => setInputTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleConfirm()}
                    placeholder={modal.type?.includes("List") ? "Ex: A Fazer, Em Andamento..." : "Ex: Ligar para cliente..."}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder:text-neutral-600 transition-all"
                  />
                </div>

                {(modal.type === "addList" || modal.type === "editList") && (
                  <ColorPicker value={inputColor} onChange={setInputColor} />
                )}

                {modal.type === "addCard" && (
                  <>
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Descrição (opcional)</label>
                      <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)}
                        placeholder="Detalhes adicionais..." rows={2}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder:text-neutral-600 resize-none transition-all"
                      />
                    </div>

                    {isAdmin && sellers.length > 0 && (
                      <div>
                        <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Responsável</label>
                        <select value={inputAssignedTo} onChange={e => setInputAssignedTo(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 transition-all cursor-pointer">
                          <option value="">Sem responsável</option>
                          {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Prioridade</label>
                      <div className="flex gap-2">
                        {(["Baixa", "Normal", "Alta"] as const).map(p => {
                          const cfg = PRIORITY_CFG[p];
                          return (
                            <button key={p} type="button" onClick={() => setInputPriority(p)}
                              className={cn("flex-1 py-2 rounded-xl text-xs font-bold border transition-all",
                                inputPriority === p ? cn(cfg.bg, cfg.color) : "bg-transparent border-white/10 text-neutral-500 hover:border-white/20"
                              )}>
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Prazo (opcional)</label>
                      <input type="date" value={inputDueDate} onChange={e => setInputDueDate(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 transition-all [color-scheme:dark]"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
