import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";

// Drop-in replacement for <select>: same props (value/defaultValue/onChange/name/
// id/disabled/required) and <option> children, but rendered as a themed listbox.
// onChange receives an event-like object: { target: { value, name } }.
export default function Select({ children, value, defaultValue, onChange, name, id, disabled, required, className = "", placeholder = "", style }) {
  const options = useMemo(() => {
    const out = [];
    Children.forEach(children, (c) => {
      if (isValidElement(c) && c.type === "option") {
        const v = c.props.value ?? (typeof c.props.children === "string" ? c.props.children : "");
        out.push({ value: String(v), label: c.props.children, disabled: c.props.disabled });
      }
    });
    return out;
  }, [children]);

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const cur = String(controlled ? value : inner);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const listId = useId();
  const selIdx = Math.max(0, options.findIndex((o) => o.value === cur));
  const sel = options.find((o) => o.value === cur);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = (o) => {
    if (!o || o.disabled) return;
    if (!controlled) setInner(o.value);
    onChange?.({ target: { value: o.value, name } });
    setOpen(false);
  };
  const openList = () => { if (disabled) return; setActive(selIdx); setOpen(true); };
  const onKey = (e) => {
    if (disabled) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "Tab") { setOpen(false); return; }
    if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(e.key)) e.preventDefault(); else return;
    if (!open) { if (e.key !== "Home" && e.key !== "End") openList(); return; }
    if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else pick(options[active]);
  };

  return (
    <div ref={root} className={`ui-select ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`.trim()} style={style}>
      {name && <input type="hidden" name={name} value={cur} required={required} />}
      <button type="button" id={id} className="ui-select-btn" disabled={disabled} role="combobox" aria-haspopup="listbox"
        aria-expanded={open} aria-controls={listId} onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}>
        <span className="ui-select-val">{sel ? sel.label : placeholder}</span>
        <i className="ri-arrow-down-s-line" aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="ui-select-list" role="listbox">
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === cur} aria-disabled={o.disabled || undefined}
              className={(o.value === cur ? "sel " : "") + (i === active ? "act" : "")}
              onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
              <span>{o.label}</span>{o.value === cur && <i className="ri-check-line" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
