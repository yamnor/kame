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
    const paragraphs = document.querySelectorAll('p');
    slideRefs.current = Array.from(paragraphs);
  }, [parsedContent.htmlContent]);

  useEffect(() => {
    currentSlideRef.current = currentSlide;
    if (slideRefs.current.length > 0) {
      showSlide(currentSlide, slideRefs.current);
    }
  }, [currentSlide, parsedContent.htmlContent]);

  const {
    size = 'var(--text-size)',
    color = 'var(--black)',
    background = 'white'
  } = parsedContent.frontmatter;

  return (
    <div className="slide" style={{ fontSize: size, color: color, backgroundColor: background }}>
      {parsedContent.htmlContent}
    </div>
  );
};

const CodeArea = ({ content, setContent }) => {
  return (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      placeholder="Type or paste markdown code here..."
    />
  );
}

const App = () => {
  const [mode, setMode] = useState('view');
  const [content, setContent] = useState('🐢');
  const [isCopied, setIsCopied] = useState(false);

  const serverUrl = 'https://oden.yamnor.me';
  const exampleKey = "NTv3go"

  const saveContent = async (hash) => {
    const response = await fetch(`${serverUrl}/add`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hash: hash }),
    });
    const { key } = await response.json();
    return key;
  };

  const loadContentByKey = async (key) => {
    const response = await fetch(`${serverUrl}/${key}`);
    const { hash } = await response.json();
    if (hash) {
      setContent(decodeContent(hash));
    }
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
      //loadContentByKey(exampleKey);
      window.location.hash = "";
    }
  }, []);

  const handleLinkButton = async () => {
    const encodedContent = encodeContent(content);
    let url = '';
    if (window.location.hash) {
      url = `${window.location.origin}/#${encodedContent}`;
      } else {
      const key = await saveContent(encodedContent);
      url = `${window.location.origin}/${key}`;
    }
    if (url) {
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 600);
    }
  };

  const handleInfoButton = () => {
    loadContentByKey(exampleKey);
  }

  return (
    <main>
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
      {mode === 'view' ? (
        <ViewArea content={content} />
      ) : (
        <CodeArea content={content} setContent={setContent} />
      )}
    </main>
  )
}

export default App
