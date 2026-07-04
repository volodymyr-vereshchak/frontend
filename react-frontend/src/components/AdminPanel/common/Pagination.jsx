import React from 'react';

const btnBase = {
  padding: '2px 8px',
  fontSize: 12,
  cursor: 'pointer',
  borderRadius: 4,
  border: '1px solid #3a3a3a',
};

/**
 * Спільний блок пагінації адмін-вкладок: кнопки розміру сторінки + ‹ N/M ›.
 * `children` рендериться зліва (напр. «Показано: X / Y»).
 */
export default function Pagination({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  onPageChange,
  sizes = [10, 50, 100],
  children,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      {children}
      <div style={{ display: 'flex', gap: 4 }}>
        {sizes.map(size => (
          <button
            key={size}
            onClick={() => onPageSizeChange(size)}
            style={{
              ...btnBase,
              background: pageSize === size ? '#1565c0' : '#2a2a2a',
              color: pageSize === size ? '#fff' : '#aaa',
            }}
          >
            {size}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{ ...btnBase, fontSize: 16, background: '#2a2a2a', color: '#aaa', lineHeight: 1 }}
        >
          ‹
        </button>
        <span style={{ color: '#aaa', fontSize: 12 }}>{currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{ ...btnBase, fontSize: 16, background: '#2a2a2a', color: '#aaa', lineHeight: 1 }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
