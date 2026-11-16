import { useEffect } from 'react'

export default function Modal({ titulo, onFechar, children }) {
  useEffect(() => {
    const fechar = (e) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [onFechar])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
