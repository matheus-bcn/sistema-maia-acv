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
  carregarRotinaAction, criarListaAction, editarListaAction, excluirListaAction,
  criarCartaoAction, editarCartaoAction, excluirCartaoAction, moverCartaoAction,
  reordenarListasAction, reordenarCartoesAction, listarVendedoresParaKanbanAction,
} from "@/lib/actions/kanban";

// ── Tipos ──────────────────────────────────────────────────

interface Seller { id: string; name: string; avatar: string | null; }
interface KanbanList { id: string; title: string; position: number; color: string; }
interface KanbanCard {
  id: string; list_id: string; title: string; description: string | null;
  position: number; due_date: string | null; priority: string; assigned_to: string | null;
}

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
function isOverdue(d: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(d + "T00:00:00") < today;
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
              value === key
                ? `ring-2 ${cfg.ring} ring-offset-2 ring-offset-neutral-900 scale-110`
                : "opacity-60 hover:opacity-100 hover:scale-105"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ── Cartão Sortável ────────────────────────────────────────

function CardItem({
  card, lists, sellers, onEdit, onDelete, onMove,
}: {
  card: KanbanCard; lists: KanbanList[]; sellers: Seller[];
  onEdit: (card: KanbanCard) => void;
  onDelete: (cardId: string) => void;
  onMove: (cardId: string, listId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
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
      <div className="flex items-start justify-between gap-2">
        <div {...attributes} {...listeners} className="flex-1 cursor-grab active:cursor-grabbing min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">{card.title}</p>
          {card.description && (
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed line-clamp-2">{card.description}</p>
          )}
          {/* Badges */}
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

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded text-neutral-600 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
            <Icon icon="mdi:dots-horizontal" className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-7 w-44 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-1 z-20 overflow-hidden">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(card); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-colors">
                  <Icon icon="mdi:pencil" className="h-3.5 w-3.5" /> Editar cartão
                </button>
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
      </div>
    </div>
  );
}

// ── Coluna Sortável ────────────────────────────────────────

function KanbanColumn({
  list, cards, lists, sellers, onAddCard, onEditList, onDeleteList, onEditCard, onDeleteCard, onMoveCard,
}: {
  list: KanbanList; cards: KanbanCard[]; lists: KanbanList[]; sellers: Seller[];
  onAddCard: (listId: string) => void;
  onEditList: (list: KanbanList) => void;
  onDeleteList: (listId: string) => void;
  onEditCard: (card: KanbanCard) => void;
  onDeleteCard: (cardId: string) => void;
  onMoveCard: (cardId: string, listId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id });
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
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 transition-colors">
            <Icon icon="mdi:drag-vertical" className="h-4 w-4" />
          </div>
          <h3 className={cn("font-black text-sm truncate", lc.text)}>{list.title}</h3>
          <span className="text-[10px] font-bold text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded-full flex-shrink-0">{cards.length}</span>
        </div>
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
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-280px)]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <CardItem key={card.id} card={card} lists={lists} sellers={sellers}
              onEdit={onEditCard} onDelete={onDeleteCard} onMove={onMoveCard} />
          ))}
        </SortableContext>
      </div>
      <button type="button" onClick={() => onAddCard(list.id)}
        className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5">
        <Icon icon="mdi:plus" className="h-4 w-4" /> Adicionar cartão
      </button>
    </div>
  );
}

// ── Modal Universal ────────────────────────────────────────

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

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);

  const [modal, setModal] = useState<{
    type: "addList" | "editList" | "addCard" | "editCard" | "deleteList" | "deleteCard" | null;
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

  const carregarDados = useCallback(async (sellerId?: string) => {
    setLoading(true);
    const data = await carregarRotinaAction(sellerId);
    setLists(data.lists as KanbanList[]);
    setCards(data.cards as KanbanCard[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const sellerList = await listarVendedoresParaKanbanAction();
      if (sellerList.length > 0) {
        setIsAdmin(true);
        setSellers(sellerList as Seller[]);
      }
      await carregarDados();
    };
    init();
  }, [carregarDados]);

  const handleSellerChange = async (sellerId: string | undefined) => {
    setSelectedSellerId(sellerId);
    await carregarDados(sellerId);
  };

  const openModal = (type: typeof modal.type, opts?: { listId?: string; card?: KanbanCard; list?: KanbanList }) => {
    setModalError(null);
    setInputTitle(type === "editList" ? (opts?.list?.title ?? "") : type === "editCard" ? (opts?.card?.title ?? "") : "");
    setInputDesc(type === "editCard" ? (opts?.card?.description ?? "") : "");
    setInputColor(type === "editList" ? (opts?.list?.color ?? "violet") : "violet");
    setInputPriority(type === "editCard" ? (opts?.card?.priority ?? "Normal") : "Normal");
    setInputDueDate(type === "editCard" ? (opts?.card?.due_date ?? "") : "");
    setInputAssignedTo(
      type === "editCard" ? (opts?.card?.assigned_to ?? "") :
      type === "addCard" ? (selectedSellerId ?? "") : ""
    );
    setModal({ type, ...opts });
  };

  const closeModal = () => { setModal({ type: null }); setModalError(null); };

  const handleConfirm = async () => {
    setModalLoading(true);
    setModalError(null);
    try {
      if (modal.type === "addList") {
        if (!inputTitle.trim()) { setModalError("Digite um título para a lista."); return; }
        const res = await criarListaAction(inputTitle, inputColor, selectedSellerId);
        if (res.error) { setModalError(res.error); return; }
        await carregarDados(selectedSellerId);

      } else if (modal.type === "editList" && modal.list) {
        if (!inputTitle.trim()) { setModalError("Digite um título."); return; }
        const res = await editarListaAction(modal.list.id, inputTitle, inputColor);
        if (res.error) { setModalError(res.error); return; }
        await carregarDados(selectedSellerId);

      } else if (modal.type === "deleteList" && modal.list) {
        const res = await excluirListaAction(modal.list.id);
        if (res.error) { setModalError(res.error); return; }
        await carregarDados(selectedSellerId);

      } else if (modal.type === "addCard" && modal.listId) {
        if (!inputTitle.trim()) { setModalError("Digite um título para o cartão."); return; }
        const res = await criarCartaoAction(modal.listId, inputTitle, inputDesc, inputPriority, inputDueDate, inputAssignedTo || undefined, selectedSellerId);
        if (res.error) { setModalError(res.error); return; }
        await carregarDados(selectedSellerId);

      } else if (modal.type === "editCard" && modal.card) {
        if (!inputTitle.trim()) { setModalError("Digite um título."); return; }
        const res = await editarCartaoAction(modal.card.id, inputTitle, inputDesc, inputPriority, inputDueDate, inputAssignedTo || undefined, modal.card.assigned_to || undefined);
        if (res.error) { setModalError(res.error); return; }
        await carregarDados(selectedSellerId);

      } else if (modal.type === "deleteCard" && modal.card) {
        const res = await excluirCartaoAction(modal.card.id);
        if (res.error) { setModalError(res.error); return; }
        await carregarDados(selectedSellerId);
      }

      closeModal();
    } finally {
      setModalLoading(false);
    }
  };

  const handleMoveCard = async (cardId: string, newListId: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, list_id: newListId } : c));
    await moverCartaoAction(cardId, newListId);
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
    modal.type === "addCard"    ? "Novo Cartão"   :
    modal.type === "editCard"   ? "Editar Cartão" : "Excluir Cartão";

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">

      {/* Header */}
      <header className="mb-6 flex-shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Icon icon="mdi:view-column" className="h-8 w-8 text-violet-400" />
              Rotina
            </h2>
            <p className="text-neutral-400 mt-1">Organize suas tarefas e atividades no estilo Kanban</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && sellers.length > 0 && (
              <div className="flex items-center gap-2">
                <Icon icon="mdi:account-switch" className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                <select value={selectedSellerId ?? ""}
                  onChange={e => handleSellerChange(e.target.value || undefined)}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 transition-all cursor-pointer">
                  <option value="">Meu quadro</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button type="button" onClick={() => openModal("addList")}
              className="flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:bg-neutral-200 hover:scale-105">
              <Icon icon="mdi:plus" className="h-4 w-4" /> Nova Lista
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isAdmin && selectedSellerId && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-sm">
                <Icon icon="mdi:eye" className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <span className="text-violet-300 font-semibold">
                  Gerenciando rotina de: <span className="text-white">{sellers.find(s => s.id === selectedSellerId)?.name}</span>
                </span>
                <button type="button" onClick={() => handleSellerChange(undefined)}
                  className="ml-auto text-violet-400 hover:text-white transition-colors text-xs font-bold">
                  Voltar ao meu quadro
                </button>
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
      ) : lists.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
          <Icon icon="mdi:view-column-outline" className="h-20 w-20 text-neutral-700 mb-4" />
          <h3 className="text-xl font-black text-white mb-2">Nenhuma lista ainda</h3>
          <p className="text-neutral-400 text-sm mb-6 max-w-xs">Crie sua primeira lista para começar a organizar sua rotina de vendas</p>
          <button type="button" onClick={() => openModal("addList")}
            className="flex items-center gap-2 rounded-xl bg-violet-500 px-6 py-3 text-sm font-bold text-white hover:bg-violet-600 transition-colors">
            <Icon icon="mdi:plus" className="h-5 w-5" /> Criar primeira lista
          </button>
        </motion.div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
            <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map(list => (
                <KanbanColumn key={list.id} list={list}
                  cards={cards.filter(c => c.list_id === list.id).sort((a, b) => a.position - b.position)}
                  lists={lists} sellers={sellers}
                  onAddCard={(listId) => openModal("addCard", { listId })}
                  onEditList={(l) => openModal("editList", { list: l })}
                  onDeleteList={(listId) => openModal("deleteList", { list: lists.find(l => l.id === listId) })}
                  onEditCard={(card) => openModal("editCard", { card })}
                  onDeleteCard={(cardId) => openModal("deleteCard", { card: cards.find(c => c.id === cardId) })}
                  onMoveCard={handleMoveCard}
                />
              ))}
            </SortableContext>
            <button type="button" onClick={() => openModal("addList")}
              className="flex-shrink-0 w-72 flex items-center gap-2 px-4 py-4 text-sm font-bold text-neutral-500 hover:text-white border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl transition-all">
              <Icon icon="mdi:plus" className="h-5 w-5" /> Nova lista
            </button>
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

      {/* Modais */}
      <AnimatePresence>
        {modal.type && (
          <Modal isOpen title={modalTitle} onClose={closeModal} onConfirm={handleConfirm}
            loading={modalLoading} error={modalError}>

            {(modal.type === "deleteList" || modal.type === "deleteCard") ? (
              <p className="text-sm text-neutral-400">
                {modal.type === "deleteList"
                  ? `Tem certeza que deseja excluir a lista "${modal.list?.title}" e todos os seus cartões?`
                  : `Tem certeza que deseja excluir o cartão "${modal.card?.title}"?`}
              </p>
            ) : (
              <div className="space-y-4">
                {/* Título */}
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Título</label>
                  <input autoFocus type="text" value={inputTitle} onChange={e => setInputTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleConfirm()}
                    placeholder={modal.type?.includes("List") ? "Ex: A Fazer, Em Andamento..." : "Ex: Ligar para cliente..."}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder:text-neutral-600 transition-all"
                  />
                </div>

                {/* Cor (listas) */}
                {(modal.type === "addList" || modal.type === "editList") && (
                  <ColorPicker value={inputColor} onChange={setInputColor} />
                )}

                {/* Campos do cartão */}
                {(modal.type === "addCard" || modal.type === "editCard") && (
                  <>
                    <div>
                      <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Descrição (opcional)</label>
                      <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)}
                        placeholder="Detalhes adicionais..." rows={2}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 placeholder:text-neutral-600 resize-none transition-all"
                      />
                    </div>

                    {/* Responsável (admin vê todos os vendedores) */}
                    {isAdmin && sellers.length > 0 && (
                      <div>
                        <label className="text-xs font-bold uppercase text-neutral-500 mb-1.5 block">Responsável</label>
                        <select value={inputAssignedTo} onChange={e => setInputAssignedTo(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 transition-all cursor-pointer">
                          <option value="">Sem responsável</option>
                          {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Prioridade */}
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

                    {/* Prazo */}
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
