import React, { useState, useEffect, useRef } from 'react'
import { Link, Eye, Code, Info, Turtle } from 'lucide-react'
import LZString from 'lz-string'
import Tippy from '@tippyjs/react'
import 'tippy.js/dist/tippy.css'
import { marked } from 'marked'
import parse from "html-react-parser"
import fm from 'front-matter';

const encodeContent = (content) => {
  const encodedContent = LZString.compressToEncodedURIComponent(content)
  return encodedContent
}

const decodeContent = (encodedContent) => {
  const decodedContent = LZString.decompressFromEncodedURIComponent(encodedContent)
  return decodedContent || ''
}

const markdownRenderer = (content) => {
  const { attributes: frontmatter, body: markdownContent } = fm(content);

  const renderer = {
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    paragraph({ tokens }) {
      const text = this.parser.parseInline(tokens);
      return `<div class="page"><p>${text}</p></div>`;
    },
    codespan({ tokens }) {
      const text = this.parser.parseInline(tokens);
      return `<code>${text}</code>`;
    },
    br() {
      return '</p><p>';
    },
    heading({ tokens, text }) {
      const className = `kind-${tokens.length}`;
      return `</section><section class=${className}>`;
    }
  };

  const tokenizer = {
    code(src) { return; },
    list(src) { return; },
    hr(src) { return; },
    table(src) { return; },
    blockquote(src) {
      const cap = this.rules.block.blockquote.exec(src);
      if (cap) {
        const content = cap[0].trim();
        const imgMatch = /^> (https?:\/\/\S+\.(jpg|jpeg|png|gif|svg))/.exec(content);
        if (imgMatch) {
          const imgUrl = imgMatch[1];
          return {
            type: 'html',
            raw: cap[0],
            text: `<div class="page"><img src="${imgUrl}" alt="Image" /></div>`,
            tokens: []
          };
        }
        return;
      }
      return;
    },
    paragraph(src) {
      const cap = /^([^\n]+(?:\n(?!blockquote|\n)[^\n]+)*)/.exec(src);
      if (cap) {
        const text = cap[1].trim();
        return {
          type: 'paragraph',
          raw: cap[0],
          text,
          tokens: this.lexer.inline(text)
        };
      }
    },
    codespan(src) {
      const cap = this.rules.inline.code.exec(src);
      if (cap) {
        const text = cap[2];
        return {
          type: 'codespan',
          raw: cap[0],
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
  }

  marked.use({ renderer, tokenizer });
  const htmlContent = marked(markdownContent, { gfm: true, breaks: true });
  return { frontmatter, htmlContent: parse(htmlContent) };
};

const showSlide = (index, slides) => {
  slides.forEach((slide, i) => {
    if (slide) {
      slide.classList.remove('active');
      if (i === index) {
        slide.classList.add('active');
      }
    }
  });
};

const applyThemeVariables = (themeFile) => {
  return fetch(`/theme/${themeFile}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load theme file');
      }
      return response.text();
    })
    .then((cssText) => {
      const root = document.documentElement.style;
      const regex = /--([\w-]+)\s*:\s*([^;]+);/g;
      let match;
      while ((match = regex.exec(cssText)) !== null) {
        const [, varName, varValue] = match;
        root.setProperty(`--${varName.trim()}`, varValue.trim());
      }
    })
    .catch((error) => console.error('Failed to load theme file:', error));
};

const applyFrontmatterVariables = (frontmatterVariables = {}) => {
  const root = document.documentElement.style;
  Object.entries(frontmatterVariables).forEach(([varName, varValue]) => {
    root.setProperty(`--${varName}`, varValue);
  });
};

const ViewArea = ({ content }) => {
  const slideRefs = useRef([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const currentSlideRef = useRef(currentSlide);
  const [parsedContent, setParsedContent] = useState({ frontmatter: {}, htmlContent: '' });

  useEffect(() => {
    const { frontmatter, htmlContent } = markdownRenderer(content);
    setParsedContent({ frontmatter, htmlContent });
  }, [content]);

  useEffect(() => {
    const keyNav = (e) => {
      if (e.key === 'ArrowRight' && currentSlideRef.current < slideRefs.current.length - 1) {
        setCurrentSlide((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentSlideRef.current > 0) {
        setCurrentSlide((prev) => prev - 1);
      }
    };
    document.addEventListener('keydown', keyNav);
    return () => {
      document.removeEventListener('keydown', keyNav);
    };
  }, []);

  useEffect(() => {
    const paragraphs = document.querySelectorAll('div.page');
    slideRefs.current = Array.from(paragraphs);
  }, [parsedContent.htmlContent]);

  useEffect(() => {
    currentSlideRef.current = currentSlide;
    if (slideRefs.current.length > 0) {
      showSlide(currentSlide, slideRefs.current);
    }
  }, [currentSlide, parsedContent.htmlContent]);

  const {
    theme = 'default',
  } = parsedContent.frontmatter;

  const { frontmatter } = parsedContent;

  useEffect(() => {
    const themeFile = `${theme}.css`;
    applyThemeVariables(themeFile)
      .then(() => {
        applyFrontmatterVariables(frontmatter);
      })
      .catch((error) => console.error('Error applying theme and frontmatter:', error));
  }, [theme, frontmatter]);

  return (
    <section>
      {parsedContent.htmlContent}
    </section>
  );
};

const CodeArea = ({ content, setContent }) => {
  return (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      placeholder="Type or paste markdown code here..."
      wrap="off"
    />
  );
}

const App = () => {
  const [mode, setMode] = useState('view');
  const [content, setContent] = useState('🐢');
  const [isCopied, setIsCopied] = useState(false);

  const serverUrl = process.env.REACT_APP_HASH_SERVER_URL;
  const example = "info.md";

  const saveContent = async (hash) => {
    try {
      const response = await fetch(`${serverUrl}/add`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash: hash }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const { key } = await response.json();
      return key;
    } catch (error) {
      console.error('Error saving content:', error);
      return null;
    }
  };

  const loadContentByKey = async (key) => {
    try {
      const response = await fetch(`${serverUrl}/${key}`);
      const { hash } = await await response.json();
      if (hash) {
        setContent(decodeContent(hash));
      }
    } catch (error) {
      setContent('データを\nロード\nできません😢');
    }
  };

  const loadStaticContent = async (fileName) => {
    try {
      const response = await fetch(`/${fileName}`);
      if (response.ok) {
        const text = await response.text();
        setContent(text);
      } else {
        setContent('データを\nロード\nできません😢');
      }
    } catch (error) {
      setContent('データを\nロード\nできません😢');
    }
  };

  const increasePixela = async () => {
    const webhookUrl = `https://pixe.la/v1/users/yamnor/webhooks/${process.env.REACT_APP_WEBHOOK_HASH}`;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Length': '0'
      }
    });
  };

  useEffect(() => {
    const key = window.location.pathname.slice(1);
    const hash = window.location.hash.slice(1);
    if (key) {
      loadContentByKey(key);
    }
    if (hash) {
      const decodedContent = decodeContent(hash);
      if (decodedContent) {
        setContent(decodedContent);
      }
    }
    if (!key && !hash) {
      loadStaticContent(example);
    }
  }, []);

  const handleLinkButton = async () => {
    const encodedContent = encodeContent(content);
    let url = '';
    if (window.location.hash) {
      url = `${window.location.origin}/#${encodedContent}`;
      } else {
      const key = await saveContent(encodedContent);
      if (key) {
        url = `${window.location.origin}/${key}`;
        increasePixela();
      }
    }
    if (url) {
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 600);
    }
  };

  const handleInfoButton = () => {
    loadStaticContent(example);
  }

  return (
    <main>
      <nav>
        <div className='buttonContainer'>
          {mode === 'view' ? (
            <button onClick={() => setMode('code')}>
              <Code size={28} />
            </button>
          ) : (
            <button onClick={() => setMode('view')}>
              <Eye size={28} />
            </button>
          )}
          {isCopied ? (
            <Tippy content="Copied!">
              <button>
                <Turtle size={28} />
              </button>
            </Tippy>
          ) : (
            <button onClick={handleLinkButton}>
              <Link size={28} />
            </button>
          )}
          <button onClick={handleInfoButton}>
            <Info size={28} />
          </button>
        </div>
      </nav>
      {mode === 'view' ? (
        <ViewArea content={content} />
      ) : (
        <CodeArea content={content} setContent={setContent} />
      )}
    </main>
  )
}

export default App
