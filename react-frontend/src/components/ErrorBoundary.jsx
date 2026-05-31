import React from 'react';
import { reportError } from '../utils/clientLogger';

// Minimal localized strings — the boundary is a class component rendered above
// the LanguageProvider, so it reads the saved language directly instead of t().
const TEXT = {
  ru: {
    title: 'Что-то пошло не так',
    body: 'Произошла ошибка в приложении. Она записана в журнал. Попробуйте перезагрузить страницу.',
    reload: 'Перезагрузить',
  },
  uk: {
    title: 'Щось пішло не так',
    body: 'Сталася помилка в застосунку. Її записано до журналу. Спробуйте перезавантажити сторінку.',
    reload: 'Перезавантажити',
  },
};

function pickLang() {
  const saved = localStorage.getItem('hlviewer-language');
  return saved === 'uk' ? 'uk' : 'ru';
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const stack =
      (error && error.stack ? error.stack : '') +
      '\n\nComponent stack:' +
      (info && info.componentStack ? info.componentStack : '');
    reportError(error && error.message ? error.message : 'React render error', {
      level: 'fatal',
      stack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = TEXT[pickLang()];
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#1a1a1a',
          color: '#e0e0e0',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h1 style={{ margin: 0, fontSize: 22, color: '#B9E42B' }}>{t.title}</h1>
        <p style={{ margin: 0, maxWidth: 440, lineHeight: 1.5, color: '#a0a0a0' }}>{t.body}</p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            background: '#B9E42B',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.reload}
        </button>
      </div>
    );
  }
}
