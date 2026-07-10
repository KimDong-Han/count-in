// SEO용 본문 콘텐츠. 도구(첫 화면) 아래에 배치돼 스크롤해야 보인다.
// 감추는 게 아니라 "아래에 둠"이라 모바일 우선 색인에도 걸린다.
// 언어 토글에 맞춰 ko/en 전환.

const CONTENT = {
  ko: {
    h1: "Count-In — 악보 자동 넘김 ·  카운트다운 후 반주 재생",
    origin: "베이스 연습하다가 악보 넘기기가 귀찮아서 만들었습니다.",
    intro:
      "Count-In은 유튜브 반주에 맞춰 악보 PDF가 자동으로 넘어가는 무료 온라인 연습 도구입니다. 페이지를 넘길 시각을 정해두면 카운트다운 뒤 반주가 시작되고, 그 재생 위치에 맞춰 악보가 저절로 넘어갑니다. 온라인 메트로놈도 함께 제공합니다.",
    forWhoTitle: "이런 분께 좋아요",
    forWho: [
      "연습 중 손으로 악보를 넘기기 힘들고 귀찮은 분",
      "악기 연습 중 유튜브 반주에 맞춰 악보를 자동으로 넘기고 싶은 분",
      "반주에 카운트다운을 넣어 정확한 박자에 시작하고 싶은 분",
    ],
    howTitle: "사용법",
    how: [
      "유튜브 반주 링크를 붙입니다.",
      "연습할 악보 PDF를 엽니다. (파일은 브라우저 안에서만 열려요)",
      "페이지 넘길 시각을 정하고 시작하면, 반주에 맞춰 악보가 자동으로 넘어갑니다.",
      "내가 작성한 설정을 공유하고 싶으면, '공유하기' 버튼을 눌러 제목·가수·닉네임을 적고 공유하면 됩니다.",
    ],
    faqTitle: "FAQ",
    faq: [
      [
        "악보 파일이 서버에 올라가나요?",
        "아니요. 악보 PDF는 서버에 업로드 되지 않으며 브라우저 안에서만 열립니다.",
      ],
      ["무료인가요?", "네, 설치 없이 무료로 사용할 수 있습니다."],
      [
        "태블릿이나 휴대폰에서도 되나요?",
        "네, 아이패드·갤럭시탭·스마트폰 브라우저에서 동작합니다. (아이패드는 없어서 테스트를 못해봤습니다....)\n스마트폰은 화면이 작아서 악보가 작게 보일 수 있으니, 가급적 태블릿에서 사용하시길 권장합니다.",
      ],
      [
        "재생 속도를 바꿔도 넘김 타이밍이 맞나요?",
        "넘김이 반주의 재생 위치를 기준으로 하기 때문에, 배속을 바꿔도 같은 부분에서 넘어갑니다.",
      ],
      [
        "도돌이표(반복)가 있는 곡도 되나요?",
        "네, 특정 페이지로 되돌아가는 반복 구조도 지원합니다.",
      ],
      [
        "사용중 불편한 점이나 버그는 어디로 보내면 되나요?",
        "devkim1030@gmail.com 로 이메일 보내주시면 확인 후 개선하겠습니다. 감사합니다.",
      ],
    ],
  },
  en: {
    h1: "Count-In — Auto page-turn sheet music & YouTube countdown practice tool",
    origin:
      "I built this because turning pages while practicing bass was a hassle.",
    intro:
      "Count-In is a free online practice tool that turns your sheet music PDF automatically in time with a YouTube backing track. Set when each page should turn, and after the countdown the track starts and the sheet turns itself at the right playback position. An online metronome is included too.",
    forWhoTitle: "Who it's for",
    forWho: [
      "Anyone who finds it a hassle to turn pages by hand while practicing",
      "Instrument practice where you want the sheet to turn with the backing track",
      "Anyone who wants a countdown before a YouTube track to start on the beat",
    ],
    howTitle: "How to use",
    how: [
      "Paste a YouTube backing-track link.",
      "Open your sheet music PDF. (The file opens only in your browser.)",
      "Set the page-turn times and start — the sheet turns automatically with the track.",
      "To share your setup, tap 'Share', fill in the title, artist, and nickname, then share.",
    ],
    faqTitle: "FAQ",
    faq: [
      [
        "Is my sheet music uploaded to a server?",
        "No. The PDF is never uploaded to a server and opens only in your browser.",
      ],
      ["Is it free?", "Yes, it's free to use with no installation."],
      [
        "Does it work on tablets and phones?",
        "Yes, it works in iPad, Galaxy Tab, and smartphone browsers. (I don't own an iPad, so I couldn't test it....)\nOn phones the sheet can look small due to the screen size, so a tablet is recommended.",
      ],
      [
        "Does the timing stay correct if I change playback speed?",
        "Page turns follow the track's playback position, so they land at the same spot even when you change speed.",
      ],
      [
        "Does it support songs with repeats (D.C. / repeat signs)?",
        "Yes, it supports repeat structures that jump back to an earlier page.",
      ],
      [
        "Where do I send bugs or feedback?",
        "Email devkim1030@gmail.com and I'll look into it and improve. Thank you!",
      ],
    ],
  },
};

export function SiteInfo({ lang }) {
  const c = CONTENT[lang] || CONTENT.ko;
  return (
    <footer className="siteInfo" aria-label={c.h1}>
      <div className="siteInfoInner">
        <h2>{c.h1}</h2>
        <p className="siteInfoOrigin">{c.origin}</p>
        <p className="siteInfoLead">{c.intro}</p>

        <h3>{c.forWhoTitle}</h3>
        <ul>
          {c.forWho.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>

        <h3>{c.howTitle}</h3>
        <ol>
          {c.how.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>

        <h3>{c.faqTitle}</h3>
        <dl>
          {c.faq.map(([q, a], i) => (
            <div key={i} className="siteInfoFaq">
              <dt>{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </footer>
  );
}
