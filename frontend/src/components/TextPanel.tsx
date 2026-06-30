interface Props {
  config: {
    content?: string;
  };
}

export default function TextPanel({ config }: Props) {
  const content = config.content || '<em>Пустая панель</em>';
  
  // Простая поддержка переменных {{...}}
  const processed = content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    // Здесь можно добавить реальные переменные
    return `[${key}]`;
  });
  
  return (
    <div
      className="h-full overflow-auto text-xl text-slate-200 leading-relaxed prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}