import React from 'react';
import { ResumeData, ResumeTemplate, TemplateBlock } from '../types';

interface PreviewProps {
  data: ResumeData;
  templateId: string;
  template?: ResumeTemplate;
}

export function ResumePreview({ data, templateId, template }: PreviewProps) {
  
  if (template?.layoutData) {
    const { 
      themeColor, 
      fontColor, 
      backgroundColor, 
      sidebarBackgroundColor, 
      layoutType, 
      sidebarPosition,
      mainBlocks, 
      sidebarBlocks, 
      blocks 
    } = template.layoutData;
    
    // Legacy support for older templates that used 'blocks'
    const actualMainBlocks = mainBlocks || blocks || [];
    const actualSidebarBlocks = sidebarBlocks || [];

    const renderBlock = (block: TemplateBlock) => {
      switch (block.type) {
        case 'header':
          const isTwoColumn = layoutType === 'two-column';
          const isSidebar = actualSidebarBlocks.some(b => b.id === block.id);
          
          if (isTwoColumn && isSidebar) {
            return (
              <div key={block.id} className="mb-6 flex flex-col items-center text-center border-b-2 pb-6" style={{ borderColor: themeColor }}>
                {data.basics.avatar && <img src={data.basics.avatar} alt="Avatar" className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-full shadow-sm mb-4" />}
                <div>
                  <h1 className="text-xl md:text-2xl font-bold mb-2" style={{ color: themeColor }}>{data.basics.name || '姓名'}</h1>
                  <div className="flex flex-col gap-1 md:gap-2 text-xs md:text-sm" style={{ opacity: 0.8 }}>
                    {(data.basics.gender || data.basics.age) && (
                      <span>{[data.basics.gender, data.basics.age].filter(Boolean).join(' · ')}</span>
                    )}
                    {data.basics.phone && <span>{data.basics.phone}</span>}
                    {data.basics.email && <span className="break-all">{data.basics.email}</span>}
                    {data.basics.residence && <span>{data.basics.residence}</span>}
                    {data.basics.workYears && <span>{data.basics.workYears}</span>}
                  </div>
                </div>
              </div>
            );
          }
          
          return (
            <div key={block.id} className={`mb-6 flex ${isTwoColumn ? 'flex-col items-center text-center' : 'flex-row items-center gap-4 md:gap-6'} border-b-2 pb-6`} style={{ borderColor: themeColor }}>
              {data.basics.avatar && <img src={data.basics.avatar} alt="Avatar" className={`${isTwoColumn ? 'w-24 h-24 md:w-32 md:h-32 rounded-full mb-4' : 'w-20 h-28 md:w-24 md:h-32 rounded-lg shrink-0'} object-cover shadow-sm`} />}
              <div className={isTwoColumn ? '' : 'text-left flex-1'}>
                <h1 className={`${isTwoColumn ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'} font-bold mb-2`} style={{ color: themeColor }}>{data.basics.name || '姓名'}</h1>
                <div className={`flex ${isTwoColumn ? 'flex-col items-center' : 'flex-wrap justify-start'} gap-2 md:gap-4 text-xs md:text-sm`} style={{ opacity: 0.8 }}>
                  {(data.basics.gender || data.basics.age) && (
                    <span>{[data.basics.gender, data.basics.age].filter(Boolean).join(' · ')}</span>
                  )}
                  {data.basics.phone && <span>{data.basics.phone}</span>}
                  {data.basics.email && <span className="break-all">{data.basics.email}</span>}
                  {data.basics.residence && <span>{data.basics.residence}</span>}
                  {data.basics.workYears && <span>{data.basics.workYears}</span>}
                </div>
              </div>
            </div>
          );
        case 'summary':
          if (!data.basics.summary) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-2 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 个人总结
              </h2>
              <p className="leading-relaxed text-sm" style={{ opacity: 0.9 }}>{data.basics.summary}</p>
            </section>
          );
        case 'work':
          const visibleWork = data.work.filter(w => !w.isHidden);
          if (visibleWork.length === 0) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 工作经历
              </h2>
              <div className="space-y-4">
                {visibleWork.map(w => (
                  <div key={w.id} className="text-sm">
                    <div className="flex justify-between font-bold" style={{ opacity: 0.95 }}>
                      <span>{w.company} - {w.position}</span>
                      <span style={{ opacity: 0.7 }}>{w.duration}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap" style={{ opacity: 0.85 }}>{w.description}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        case 'projects':
          const visibleProj = data.projects.filter(p => !p.isHidden);
          if (visibleProj.length === 0) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 项目经验
              </h2>
              <div className="space-y-4">
                {visibleProj.map(p => (
                  <div key={p.id} className="text-sm">
                    <div className="flex justify-between font-bold" style={{ opacity: 0.95 }}>
                      <span>{p.name}</span>
                      <span style={{ opacity: 0.7 }}>{p.duration}</span>
                    </div>
                    <div className="mb-1" style={{ opacity: 0.8 }}>角色: {p.role} | 技术栈: {p.technologies}</div>
                    <p className="whitespace-pre-wrap" style={{ opacity: 0.85 }}>{p.description}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        case 'education':
          if (data.education.length === 0) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 教育经历
              </h2>
              <div className="space-y-2">
                {data.education.map(e => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="font-bold" style={{ opacity: 0.95 }}>{e.school}</span>
                    <span style={{ opacity: 0.9 }}>{e.degree}</span>
                    <span style={{ opacity: 0.7 }}>{e.year}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        case 'skills':
          if (!data.skills && !data.hobbies) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 技能与爱好
              </h2>
              <div className="text-sm space-y-2" style={{ opacity: 0.9 }}>
                {data.skills && <div><strong style={{ opacity: 1 }}>技能：</strong><span className="whitespace-pre-wrap">{data.skills}</span></div>}
                {data.hobbies && <div><strong style={{ opacity: 1 }}>爱好：</strong>{data.hobbies}</div>}
              </div>
            </section>
          );
        case 'jobIntention':
          if (!data.jobIntention || (!data.jobIntention.targetJob && !data.jobIntention.targetCity && !data.jobIntention.expectedSalary)) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 求职意向
              </h2>
              <div className="flex flex-wrap gap-4 text-sm" style={{ opacity: 0.9 }}>
                {data.jobIntention.targetJob && <div><strong style={{ opacity: 1 }}>目标职业：</strong>{data.jobIntention.targetJob}</div>}
                {data.jobIntention.targetCity && <div><strong style={{ opacity: 1 }}>意向城市：</strong>{data.jobIntention.targetCity}</div>}
                {data.jobIntention.expectedSalary && <div><strong style={{ opacity: 1 }}>期望薪资：</strong>{data.jobIntention.expectedSalary}</div>}
              </div>
            </section>
          );
        case 'awards':
          if (!data.awards || data.awards.length === 0 || data.awards.every(a => a.isHidden)) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 获奖情况
              </h2>
              <div className="space-y-3">
                {data.awards.filter(a => !a.isHidden).map(a => (
                  <div key={a.id} className="text-sm resume-item">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold" style={{ opacity: 0.95 }}>{a.name}</span>
                      <span style={{ opacity: 0.7 }}>{a.date}</span>
                    </div>
                    {a.description && <div className="mt-1" style={{ opacity: 0.85 }}>{a.description}</div>}
                  </div>
                ))}
              </div>
            </section>
          );
        case 'certifications':
          // 资格证书展示逻辑：如果没有资格证书，或者全部被隐藏了，就不显示这个模块
          if (!data.certifications || data.certifications.length === 0 || data.certifications.every(c => c.isHidden)) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 资格证书
              </h2>
              <div className="space-y-3">
                {data.certifications.filter(c => !c.isHidden).map(c => (
                  <div key={c.id} className="text-sm resume-item">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold" style={{ opacity: 0.95 }}>{c.name}</span>
                      <span style={{ opacity: 0.7 }}>{c.date}</span>
                    </div>
                    {c.description && <div className="mt-1" style={{ opacity: 0.85 }}>{c.description}</div>}
                  </div>
                ))}
              </div>
            </section>
          );
        case 'portfolio':
          if (!data.portfolio || data.portfolio.length === 0 || data.portfolio.every(p => p.isHidden)) return null;
          return (
            <section key={block.id} className="mb-6">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: themeColor }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span> 作品集
              </h2>
              <div className="space-y-3">
                {data.portfolio.filter(p => !p.isHidden).map(p => (
                  <div key={p.id} className="text-sm resume-item">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold" style={{ opacity: 0.95 }}>{p.title}</span>
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all ml-2">{p.link}</a>}
                    </div>
                    {p.description && <div className="mt-1" style={{ opacity: 0.85 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            </section>
          );
        default:
          return null;
      }
    };

    return (
      <div 
        className={`shadow-2xl mx-auto overflow-hidden print:shadow-none print:mx-0 flex ${sidebarPosition === 'right' && layoutType === 'two-column' ? 'flex-row-reverse' : 'flex-row'} w-full max-w-[800px] min-h-[800px] md:min-h-[1131px]`} 
        style={{ backgroundColor, color: fontColor }}
      >
        {layoutType === 'two-column' && (
          <div className="w-1/3 p-4 md:p-8 break-words" style={{ backgroundColor: sidebarBackgroundColor }}>
            {actualSidebarBlocks.map(renderBlock)}
          </div>
        )}
        <div className={`p-4 md:p-8 break-words ${layoutType === 'two-column' ? 'w-2/3' : 'w-full'}`}>
          {actualMainBlocks.map(renderBlock)}
        </div>
      </div>
    );
  }

  // 模板 1: 简约通用 (Guest & User) - 标准招聘排版
  const renderTemplate1 = () => (
    <div className="p-6 md:p-10 bg-white text-gray-800 font-sans w-full max-w-[800px] min-h-[800px] md:min-h-[1131px] mx-auto shadow-lg print:shadow-none print:m-0 break-words">
      <header className="border-b-2 border-gray-800 pb-6 mb-6 flex flex-row justify-between items-center text-left">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-wider">{data.basics.name || '姓名'}</h1>
          <div className="text-xs md:text-sm text-gray-600 flex flex-wrap justify-start gap-x-4 gap-y-1">
            {data.basics.gender && <span>{data.basics.gender}</span>}
            {data.basics.age && <span>{data.basics.age}</span>}
            {data.basics.phone && <span>📞 {data.basics.phone}</span>}
            {data.basics.email && <span className="break-all">✉️ {data.basics.email}</span>}
            {data.basics.residence && <span>📍 {data.basics.residence}</span>}
            {data.basics.workYears && <span>经验：{data.basics.workYears}</span>}
          </div>
        </div>
        {data.basics.avatar && (
          <div className="ml-4 md:ml-6 shrink-0">
            <img src={data.basics.avatar} alt="Avatar" className="w-20 h-28 md:w-24 md:h-32 object-cover border border-gray-200 shadow-sm" />
          </div>
        )}
      </header>

      {data.basics.summary && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            个人总结
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{data.basics.summary}</p>
        </section>
      )}

      {data.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            教育经历
          </h2>
          <div className="space-y-3">
            {data.education.map(edu => (
              <div key={edu.id} className="flex flex-col sm:flex-row sm:justify-between text-sm gap-1 sm:gap-0">
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <span className="font-bold sm:w-48">{edu.school}</span>
                  <span className="text-gray-700">{edu.degree}</span>
                </div>
                <div className="text-gray-500 font-medium">{edu.year}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            求职意向
          </h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            {data.jobIntention.targetJob && <div><strong>目标职业：</strong>{data.jobIntention.targetJob}</div>}
            {data.jobIntention.targetCity && <div><strong>意向城市：</strong>{data.jobIntention.targetCity}</div>}
            {data.jobIntention.expectedSalary && <div><strong>期望薪资：</strong>{data.jobIntention.expectedSalary}</div>}
          </div>
        </section>
      )}

      {data.work.filter(w => !w.isHidden).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            工作经历
          </h2>
          <div className="space-y-5">
            {data.work.filter(w => !w.isHidden).map(w => (
              <div key={w.id} className="text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between font-bold mb-1 text-base gap-1 sm:gap-0">
                  <span>{w.company}</span>
                  <span className="text-gray-600 font-medium text-sm">{w.duration}</span>
                </div>
                <div className="font-medium text-gray-700 mb-2">职位：{w.position}</div>
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-gray-200">{w.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.projects && data.projects.filter(p => !p.isHidden).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            项目经验
          </h2>
          <div className="space-y-5">
            {data.projects.filter(p => !p.isHidden).map(p => (
              <div key={p.id} className="text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between font-bold mb-1 text-base gap-1 sm:gap-0">
                  <span>{p.name}</span>
                  <span className="text-gray-600 font-medium text-sm">{p.duration}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mb-2 text-gray-700">
                  {p.role && <span><span className="font-medium">角色：</span>{p.role}</span>}
                  {p.technologies && <span><span className="font-medium">技术栈：</span>{p.technologies}</span>}
                </div>
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-gray-200">{p.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(data.skills || data.hobbies) && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            其他信息
          </h2>
          {data.skills && (
            <div className="text-sm mb-3">
              <div className="font-bold mb-1">专业技能：</div>
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{data.skills}</p>
            </div>
          )}
          {data.hobbies && (
            <div className="text-sm">
              <span className="font-bold">兴趣爱好：</span>
              <span className="text-gray-700">{data.hobbies}</span>
            </div>
          )}
        </section>
      )}

      {/* 获奖情况 */}
      {data.awards && data.awards.filter(a => !a.isHidden).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            获奖情况
          </h2>
          <div className="space-y-5">
            {data.awards.filter(a => !a.isHidden).map(a => (
              <div key={a.id} className="text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between font-bold mb-1 text-base gap-1 sm:gap-0">
                  <span>{a.name}</span>
                  <span className="text-gray-600 font-medium text-sm">{a.date}</span>
                </div>
                {a.description && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-gray-200">{a.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 资格证书 */}
      {data.certifications && data.certifications.filter(c => !c.isHidden).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            资格证书
          </h2>
          <div className="space-y-5">
            {data.certifications.filter(c => !c.isHidden).map(c => (
              <div key={c.id} className="text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between font-bold mb-1 text-base gap-1 sm:gap-0">
                  <span>{c.name}</span>
                  <span className="text-gray-600 font-medium text-sm">{c.date}</span>
                </div>
                {c.description && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-gray-200">{c.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 个人作品 */}
      {data.portfolio && data.portfolio.filter(p => !p.isHidden).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 mb-3 pb-1 flex items-center">
            <span className="bg-gray-800 w-1.5 h-4 mr-2 inline-block"></span>
            作品集
          </h2>
          <div className="space-y-5">
            {data.portfolio.filter(p => !p.isHidden).map(p => (
              <div key={p.id} className="text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between font-bold mb-1 text-base gap-1 sm:gap-0">
                  <span>{p.title}</span>
                  {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all ml-2">{p.link}</a>}
                </div>
                {p.description && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-gray-200">{p.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // 模板 2: 现代专业 (仅限登录用户)
  const renderTemplate2 = () => (
    <div className="flex bg-white text-gray-800 font-sans w-full max-w-[800px] min-h-[800px] md:min-h-[1131px] mx-auto shadow-lg print:shadow-none print:m-0 break-words">
      {/* 左侧边栏 */}
      <div className="w-1/3 bg-slate-800 text-white p-4 md:p-8 flex flex-col break-words">
        <div className="flex flex-col items-center mb-8">
          {data.basics.avatar ? (
            <img src={data.basics.avatar} alt="Avatar" className="w-20 h-20 md:w-32 md:h-32 rounded-full object-cover border-2 md:border-4 border-slate-600 mb-4 shadow-md" />
          ) : (
            <div className="w-20 h-20 md:w-32 md:h-32 rounded-full border-2 md:border-4 border-slate-600 mb-4 bg-slate-700 flex items-center justify-center text-slate-400 text-2xl md:text-4xl font-bold">
              {(data.basics.name || '名')[0]}
            </div>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-center tracking-wide">{data.basics.name || '姓名'}</h1>
        </div>
        
        <div className="mb-8 space-y-3 text-xs md:text-sm text-slate-300">
          <h2 className="text-base md:text-lg font-bold border-b border-slate-600 mb-3 pb-1 uppercase tracking-wider text-white">联系方式</h2>
          {data.basics.phone && <div className="flex items-center gap-2"><span>📞</span> {data.basics.phone}</div>}
          {data.basics.email && <div className="flex items-center gap-2 break-all"><span>✉️</span> {data.basics.email}</div>}
          {(data.basics.gender || data.basics.age) && (
            <div className="flex items-center gap-2">
              <span>👤</span>
              {[data.basics.gender, data.basics.age].filter(Boolean).join(' · ')}
            </div>
          )}
          {data.basics.residence && <div className="flex items-center gap-2"><span>📍</span> {data.basics.residence}</div>}
          {data.basics.workYears && <div className="flex items-center gap-2"><span>💼</span> {data.basics.workYears}</div>}
        </div>

        {data.education.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base md:text-lg font-bold border-b border-slate-600 mb-3 pb-1 uppercase tracking-wider text-white">教育背景</h2>
            <div className="space-y-4">
              {data.education.map(edu => (
                <div key={edu.id} className="text-xs md:text-sm">
                  <div className="font-bold text-white">{edu.school}</div>
                  <div className="text-slate-300">{edu.degree}</div>
                  <div className="text-slate-400 text-[10px] md:text-xs mt-1">{edu.year}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 求职意向模块：如果求职意向对象存在，并且至少有一个字段有值，就显示这个模块 */}
        {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
          <div className="mb-8">
            <h2 className="text-base md:text-lg font-bold border-b border-slate-600 mb-3 pb-1 uppercase tracking-wider text-white">求职意向</h2>
            <div className="space-y-2 text-xs md:text-sm text-slate-300">
              {data.jobIntention.targetJob && <div><strong className="text-white">目标职业：</strong>{data.jobIntention.targetJob}</div>}
              {data.jobIntention.targetCity && <div><strong className="text-white">目标城市：</strong>{data.jobIntention.targetCity}</div>}
              {data.jobIntention.expectedSalary && <div><strong className="text-white">期望薪资：</strong>{data.jobIntention.expectedSalary}</div>}
            </div>
          </div>
        )}

        {data.skills && (
          <div className="mb-8">
            <h2 className="text-base md:text-lg font-bold border-b border-slate-600 mb-3 pb-1 uppercase tracking-wider text-white">专业技能</h2>
            <p className="text-xs md:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{data.skills}</p>
          </div>
        )}

        {data.hobbies && (
          <div className="mb-8 mt-auto">
            <h2 className="text-base md:text-lg font-bold border-b border-slate-600 mb-3 pb-1 uppercase tracking-wider text-white">爱好</h2>
            <p className="text-xs md:text-sm text-slate-300 whitespace-pre-wrap">{data.hobbies}</p>
          </div>
        )}
      </div>

      {/* 右侧主内容 */}
      <div className="w-2/3 p-4 md:p-8 bg-slate-50 break-words">
        {data.basics.summary && (
          <section className="mb-8">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 border-b-2 border-slate-200 mb-3 pb-1 uppercase tracking-wider flex items-center gap-2">
              <span className="text-slate-400">👤</span> 个人总结
            </h2>
            <p className="text-xs md:text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">{data.basics.summary}</p>
          </section>
        )}

        {data.work.filter(w => !w.isHidden).length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 mb-4 pb-1 uppercase tracking-wider flex items-center gap-2">
              <span className="text-slate-400">💼</span> 工作经历
            </h2>
            <div className="space-y-6">
              {data.work.filter(w => !w.isHidden).map(w => (
                <div key={w.id} className="text-sm relative pl-4 border-l-2 border-slate-300">
                  <div className="absolute w-2.5 h-2.5 bg-slate-400 rounded-full -left-[6px] top-1.5 border-2 border-slate-50"></div>
                  <div className="font-bold text-lg text-slate-800">{w.position}</div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-500 mb-2 font-medium gap-1 sm:gap-0">
                    <span className="text-slate-700">{w.company}</span>
                    <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 self-start sm:self-auto">{w.duration}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.projects && data.projects.filter(p => !p.isHidden).length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 mb-4 pb-1 uppercase tracking-wider flex items-center gap-2">
              <span className="text-slate-400">🚀</span> 项目经验
            </h2>
            <div className="space-y-6">
              {data.projects.filter(p => !p.isHidden).map(p => (
                <div key={p.id} className="text-sm relative pl-4 border-l-2 border-slate-300">
                  <div className="absolute w-2.5 h-2.5 bg-slate-400 rounded-full -left-[6px] top-1.5 border-2 border-slate-50"></div>
                  <div className="font-bold text-lg text-slate-800">{p.name}</div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-500 mb-1 font-medium gap-1 sm:gap-0">
                    <span className="text-slate-700">{p.role}</span>
                    <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 self-start sm:self-auto">{p.duration}</span>
                  </div>
                  {p.technologies && (
                    <div className="mb-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">技术栈：</span>{p.technologies}
                    </div>
                  )}
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 获奖情况模块：如果有获奖情况，并且至少有一个奖项没有被隐藏，就显示这个模块 */}
        {data.awards && data.awards.filter(a => !a.isHidden).length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 mb-4 pb-1 uppercase tracking-wider flex items-center gap-2">
              <span className="text-slate-400">🏆</span> 获奖情况
            </h2>
            <div className="space-y-6">
              {data.awards.filter(a => !a.isHidden).map(a => (
                <div key={a.id} className="text-sm relative pl-4 border-l-2 border-slate-300">
                  <div className="absolute w-2.5 h-2.5 bg-slate-400 rounded-full -left-[6px] top-1.5 border-2 border-slate-50"></div>
                  <div className="font-bold text-lg text-slate-800">{a.name}</div>
                  <div className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 self-start mt-1">{a.date}</div>
                  {a.description && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mt-2">{a.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 资格证书 */}
        {data.certifications && data.certifications.filter(c => !c.isHidden).length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 mb-4 pb-1 uppercase tracking-wider flex items-center gap-2">
              <span className="text-slate-400">📜</span> 资格证书
            </h2>
            <div className="space-y-6">
              {data.certifications.filter(c => !c.isHidden).map(c => (
                <div key={c.id} className="text-sm relative pl-4 border-l-2 border-slate-300">
                  <div className="absolute w-2.5 h-2.5 bg-slate-400 rounded-full -left-[6px] top-1.5 border-2 border-slate-50"></div>
                  <div className="font-bold text-lg text-slate-800">{c.name}</div>
                  <div className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 self-start mt-1">{c.date}</div>
                  {c.description && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mt-2">{c.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 个人作品模块：如果有作品集，并且至少有一个作品没有被隐藏，就显示这个模块 */}
        {data.portfolio && data.portfolio.filter(p => !p.isHidden).length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 mb-4 pb-1 uppercase tracking-wider flex items-center gap-2">
              <span className="text-slate-400">🎨</span> 作品集
            </h2>
            <div className="space-y-6">
              {data.portfolio.filter(p => !p.isHidden).map(p => (
                <div key={p.id} className="text-sm relative pl-4 border-l-2 border-slate-300">
                  <div className="absolute w-2.5 h-2.5 bg-slate-400 rounded-full -left-[6px] top-1.5 border-2 border-slate-50"></div>
                  <div className="font-bold text-lg text-slate-800">{p.title}</div>
                  {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all mt-1 block">{p.link}</a>}
                  {p.description && <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mt-2">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );

  // 模板 3: 传统表格样式
  const renderTemplate3 = () => {
    const highestDegree =
      data.education.filter((e) => !e.isHidden)[0]?.degree || '';

    return (
    <div className="table-resume-tpl bg-white text-black font-serif w-full max-w-[800px] min-h-[1131px] mx-auto p-8 shadow-lg print:shadow-none print:m-0">
      <h1 className="text-3xl font-bold text-center mb-6 tracking-widest">个人简历</h1>

      {/* 基础信息：表格网格 + 右侧照片；个人介绍单独成块在下方 */}
      <div className="mb-6">
        <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">基础信息</h2>
        <table className="w-full border-collapse border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="border border-black p-3 font-bold bg-gray-100 w-[18%] text-center">姓名</td>
              <td className="border border-black p-3 w-[22%]">{data.basics.name}</td>
              <td className="border border-black p-3 font-bold bg-gray-100 w-[18%] text-center">性别</td>
              <td className="border border-black p-3 w-[22%]">{data.basics.gender || ''}</td>
              <td className="border border-black p-2 w-[20%] text-center align-middle" rowSpan={5}>
                {data.basics.avatar ? (
                  <img src={data.basics.avatar} alt="Avatar" className="w-24 h-32 object-cover mx-auto" />
                ) : (
                  <div className="w-24 h-32 bg-gray-100 mx-auto flex items-center justify-center text-gray-400">照片</div>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-3 font-bold bg-gray-100 text-center">年龄</td>
              <td className="border border-black p-3">{data.basics.age || ''}</td>
              <td className="border border-black p-3 font-bold bg-gray-100 text-center">电话</td>
              <td className="border border-black p-3">{data.basics.phone}</td>
            </tr>
            <tr>
              <td className="border border-black p-3 font-bold bg-gray-100 text-center">工作经验</td>
              <td className="border border-black p-3">{data.basics.workYears || ''}</td>
              <td className="border border-black p-3 font-bold bg-gray-100 text-center">最高学历</td>
              <td className="border border-black p-3">{highestDegree}</td>
            </tr>
            <tr>
              <td className="border border-black p-3 font-bold bg-gray-100 text-center">常住地</td>
              <td className="border border-black p-3" colSpan={3}>{data.basics.residence || ''}</td>
            </tr>
            <tr>
              <td className="border border-black p-3 font-bold bg-gray-100 text-center">邮箱</td>
              <td className="border border-black p-3 break-all" colSpan={3}>{data.basics.email}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.basics.summary && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">个人介绍</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              <tr>
                <td className="border border-black p-3 whitespace-pre-wrap leading-relaxed">{data.basics.summary}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 表格：教育经历 */}
      {data.education.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">教育经历</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.education.map(edu => (
                <tr key={edu.id}>
                  <td className="border border-black p-3 w-1/3">{edu.year}</td>
                  <td className="border border-black p-3 font-bold w-1/3">{edu.school}</td>
                  <td className="border border-black p-3 w-1/3">{edu.degree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">求职意向</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.jobIntention.targetJob && (
                <tr>
                  <td className="border border-black p-3 font-bold bg-gray-100 w-24 text-center">目标职业</td>
                  <td className="border border-black p-3">{data.jobIntention.targetJob}</td>
                </tr>
              )}
              {data.jobIntention.targetCity && (
                <tr>
                  <td className="border border-black p-3 font-bold bg-gray-100 w-24 text-center">意向城市</td>
                  <td className="border border-black p-3">{data.jobIntention.targetCity}</td>
                </tr>
              )}
              {data.jobIntention.expectedSalary && (
                <tr>
                  <td className="border border-black p-3 font-bold bg-gray-100 w-24 text-center">期望薪资</td>
                  <td className="border border-black p-3">{data.jobIntention.expectedSalary}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 表格：工作经历 */}
      {data.work.filter(w => !w.isHidden).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">工作经历</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.work.filter(w => !w.isHidden).map(w => (
                <tr key={w.id}>
                  <td className="border border-black p-3 w-1/4 align-top">{w.duration}</td>
                  <td className="border border-black p-3 w-1/4 align-top font-bold">{w.company}</td>
                  <td className="border border-black p-3 w-1/4 align-top">{w.position}</td>
                  <td className="border border-black p-3 w-1/4 align-top whitespace-pre-wrap">{w.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 表格：项目经验 */}
      {data.projects.filter(p => !p.isHidden).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">项目经验</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.projects.filter(p => !p.isHidden).map(p => (
                <tr key={p.id}>
                  <td className="border border-black p-3 w-1/4 align-top">{p.duration}</td>
                  <td className="border border-black p-3 w-3/4 align-top">
                    <div className="font-bold mb-1">{p.name} <span className="font-normal text-gray-600">({p.role})</span></div>
                    <div className="mb-1 text-xs text-gray-600">技术栈: {p.technologies}</div>
                    <div className="whitespace-pre-wrap">{p.description}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 表格：专业技能 */}
      {(data.skills || data.hobbies) && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">附加信息</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.skills && (
                <tr>
                  <td className="border border-black p-3 font-bold bg-gray-100 w-24 text-center">专业技能</td>
                  <td className="border border-black p-3 whitespace-pre-wrap">{data.skills}</td>
                </tr>
              )}
              {data.hobbies && (
                <tr>
                  <td className="border border-black p-3 font-bold bg-gray-100 w-24 text-center">兴趣爱好</td>
                  <td className="border border-black p-3 whitespace-pre-wrap">{data.hobbies}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 表格：获奖情况 */}
      {data.awards && data.awards.filter(a => !a.isHidden).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">获奖情况</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.awards.filter(a => !a.isHidden).map(a => (
                <tr key={a.id}>
                  <td className="border border-black p-3 w-1/4 align-top">{a.date}</td>
                  <td className="border border-black p-3 w-3/4 align-top">
                    <div className="font-bold mb-1">{a.name}</div>
                    {a.description && <div className="whitespace-pre-wrap">{a.description}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 资格证书 */}
      {data.certifications && data.certifications.filter(c => !c.isHidden).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">资格证书</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.certifications.filter(c => !c.isHidden).map(c => (
                <tr key={c.id}>
                  <td className="border border-black p-3 w-1/4 align-top">{c.date}</td>
                  <td className="border border-black p-3 w-3/4 align-top">
                    <div className="font-bold mb-1">{c.name}</div>
                    {c.description && <div className="whitespace-pre-wrap">{c.description}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 表格：个人作品 */}
      {data.portfolio && data.portfolio.filter(p => !p.isHidden).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold bg-gray-200 border-2 border-black border-b-0 p-2 text-center tracking-widest">个人作品</h2>
          <table className="w-full border-collapse border-2 border-black text-sm">
            <tbody>
              {data.portfolio.filter(p => !p.isHidden).map(p => (
                <tr key={p.id}>
                  <td className="border border-black p-3 w-1/4 align-top">{p.title}</td>
                  <td className="border border-black p-3 w-3/4 align-top">
                    {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all mb-1 block">{p.link}</a>}
                    {p.description && <div className="whitespace-pre-wrap">{p.description}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    );
  };

  // 模板 4: PPT 风格
  const renderTemplate4 = () => (
    // 取消固定纵横比、取消内部滚动条，内容自适应高度
    <div className="bg-slate-900 text-white font-sans w-full overflow-hidden max-w-[960px] mx-auto p-10 shadow-2xl print:shadow-none print:m-0 relative flex flex-col">
      {/* 背景装饰 */}
      <div className="absolute top-0 right-[-5%] w-[50%] h-full bg-gradient-to-bl from-blue-600/30 to-purple-600/10 transform rotate-12 skew-x-12 pointer-events-none"></div>
      <div className="absolute bottom-[-5%] left-[-10%] w-[40%] h-[60%] bg-gradient-to-tr from-teal-500/20 to-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* 头部区域 */}
      <div className="flex items-center gap-8 mb-8 relative z-10 border-b border-white/20 pb-6">
        {data.basics.avatar ? (
          <img src={data.basics.avatar} alt="Avatar" className="w-32 h-32 rounded-full border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] object-cover" />
        ) : (
          <div className="w-32 h-32 rounded-full border-4 border-blue-500 bg-slate-800 flex items-center justify-center text-4xl font-bold text-blue-400">
            {(data.basics.name || '名')[0]}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-5xl font-black tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{data.basics.name || '姓名'}</h1>
          <div className="flex gap-6 text-blue-200 text-sm font-medium">
            {data.basics.phone && <span className="flex items-center gap-2">📱 {data.basics.phone}</span>}
            {data.basics.email && <span className="flex items-center gap-2">✉️ {data.basics.email}</span>}
          </div>
        </div>
      </div>

      {/* 内容区域 (两列布局) */}
      <div className="flex gap-8 flex-1 relative z-10">
        {/* 左列：不滚动，内容全显 */}
        <div className="w-1/2 flex flex-col gap-6 pr-4">
          {data.basics.summary && (
            <section>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-white rounded"></span> Profile</h2>
              <p className="text-sm text-gray-100 leading-relaxed bg-white/10 p-4 rounded-lg border border-white/20">{data.basics.summary}</p>
            </section>
          )}
          
          {/* 求职意向 */}
          {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
            <section>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-white rounded"></span> Job Intention</h2>
              <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                {data.jobIntention.targetJob && <div><strong className="text-blue-300">Target Job:</strong> {data.jobIntention.targetJob}</div>}
                {data.jobIntention.targetCity && <div><strong className="text-blue-300">Target City:</strong> {data.jobIntention.targetCity}</div>}
                {data.jobIntention.expectedSalary && <div><strong className="text-blue-300">Expected Salary:</strong> {data.jobIntention.expectedSalary}</div>}
              </div>
            </section>
          )}

          {data.work.filter(w => !w.isHidden).length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-blue-500 rounded"></span> Experience</h2>
              <div className="space-y-4">
                {data.work.filter(w => !w.isHidden).map(w => (
                  <div key={w.id} className="bg-white/5 p-4 rounded-lg border border-white/10 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg text-white">{w.position}</h3>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">{w.duration}</span>
                    </div>
                    <div className="text-white text-sm mb-2">{w.company}</div>
                    <p className="text-sm text-gray-200">{w.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.skills && (
            <section>
              <h2 className="text-xl font-bold text-emerald-400 mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-emerald-500 rounded"></span> Skills</h2>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <p className="text-sm text-gray-300">{data.skills}</p>
              </div>
            </section>
          )}

          {/* 获奖情况 */}
          {data.awards && data.awards.filter(a => !a.isHidden).length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-white rounded"></span> Awards</h2>
              <div className="space-y-4">
                {data.awards.filter(a => !a.isHidden).map(a => (
                  <div key={a.id} className="bg-white/5 p-4 rounded-lg border border-white/10 border-l-4 border-l-yellow-500">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg text-white">{a.name}</h3>
                      <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">{a.date}</span>
                    </div>
                    {a.description && <p className="text-xs text-gray-400 line-clamp-3">{a.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 右列：不滚动，内容全显 */}
        <div className="w-1/2 flex flex-col gap-6 pr-4">
          {data.education.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-teal-400 mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-teal-500 rounded"></span> Education</h2>
              <div className="space-y-3">
                {data.education.map(edu => (
                  <div key={edu.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                    <div>
                      <div className="font-bold text-white">{edu.school}</div>
                      <div className="text-teal-300 text-sm">{edu.degree}</div>
                    </div>
                    <span className="text-xs text-gray-400">{edu.year}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.projects.filter(p => !p.isHidden).length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-purple-500 rounded"></span> Projects</h2>
              <div className="space-y-3">
                {data.projects.filter(p => !p.isHidden).map(p => (
                  <div key={p.id} className="bg-white/5 p-3 rounded-lg border border-white/10 border-l-4 border-l-purple-500">
                    <div className="font-bold text-white mb-1">{p.name}</div>
                    <div className="text-xs text-purple-300 mb-1">{p.technologies}</div>
                    <p className="text-xs text-gray-300 h-auto">{p.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 资格证书 */}
          {data.certifications && data.certifications.filter(c => !c.isHidden).length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-green-500 rounded"></span> Certifications</h2>
              <div className="space-y-3">
                {data.certifications.filter(c => !c.isHidden).map(c => (
                  <div key={c.id} className="bg-white/5 p-3 rounded-lg border border-white/10 border-l-4 border-l-green-500">
                    <div className="font-bold text-white mb-1">{c.name}</div>
                    <div className="text-xs text-green-300 mb-1">{c.date}</div>
                    {c.description && <p className="text-xs text-gray-400 line-clamp-3">{c.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 个人作品 */}
          {data.portfolio && data.portfolio.filter(p => !p.isHidden).length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-pink-400 mb-3 flex items-center gap-2 uppercase tracking-widest"><span className="w-8 h-1 bg-pink-500 rounded"></span> Portfolio</h2>
              <div className="space-y-3">
                {data.portfolio.filter(p => !p.isHidden).map(p => (
                  <div key={p.id} className="bg-white/5 p-3 rounded-lg border border-white/10 border-l-4 border-l-pink-500">
                    <div className="font-bold text-white mb-1">{p.title}</div>
                    {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-pink-300 text-sm hover:underline break-all">{p.link}</a>}
                    {p.description && <p className="text-xs text-gray-400 line-clamp-3 mt-1">{p.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );

  const skillTagList = (data.skills || '')
    .split(/[,，、;；\n|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const eduDegree = () =>
    data.education.find((e) => !e.isHidden)?.degree || '';

  // 模板 6: 商务蓝调 — 深蓝头图 + 圆角色块标题（参考招聘 App 蓝头样式）
  const renderTemplate6 = () => (
    <div className="bg-white text-gray-800 font-sans w-full max-w-[800px] min-h-[800px] md:min-h-[1131px] mx-auto shadow-lg print:shadow-none print:m-0 break-words overflow-hidden">
      <header className="bg-[#1e3a5f] text-white px-6 md:px-10 py-7 flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-wide mb-2">{data.basics.name || '姓名'}</h1>
          <div className="text-xs md:text-sm text-blue-100/90 mb-3 flex flex-wrap gap-x-2">
            {data.basics.gender && <span>{data.basics.gender}</span>}
            {data.basics.age && <span>{data.basics.age}</span>}
            {eduDegree() && <span>{eduDegree()}</span>}
            {data.basics.workYears && <span>{data.basics.workYears}</span>}
            {data.jobIntention?.targetCity && (
              <>
                <span>|</span>
                <span>{data.jobIntention.targetCity}</span>
              </>
            )}
          </div>
          <div className="space-y-1 text-xs md:text-sm text-blue-50">
            {data.basics.phone && <div>☎ {data.basics.phone}</div>}
            {data.basics.email && <div className="break-all">✉ {data.basics.email}</div>}
            {data.basics.residence && <div>📍 {data.basics.residence}</div>}
            {!data.basics.residence && data.jobIntention?.targetCity && <div>📍 {data.jobIntention.targetCity}</div>}
          </div>
        </div>
        {data.basics.avatar ? (
          <img src={data.basics.avatar} alt="Avatar" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-white/40 shrink-0" />
        ) : (
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/15 flex items-center justify-center text-2xl font-bold shrink-0">
            {(data.basics.name || '名')[0]}
          </div>
        )}
      </header>

      <div className="px-6 md:px-10 py-6 space-y-5">
        {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">求职期望</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {data.jobIntention.targetJob && <span>期望：{data.jobIntention.targetJob}</span>}
              {data.jobIntention.targetCity && <span>城市：{data.jobIntention.targetCity}</span>}
              {data.jobIntention.expectedSalary && <span>薪资：{data.jobIntention.expectedSalary}</span>}
            </div>
          </section>
        )}

        {data.work.filter((w) => !w.isHidden).length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">工作经历</h2>
            <div className="space-y-4">
              {data.work.filter((w) => !w.isHidden).map((w) => (
                <div key={w.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span>{w.duration}</span>
                    <span>{w.company}</span>
                    <span>{w.position}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.education.filter((e) => !e.isHidden).length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">教育经历</h2>
            <div className="space-y-2">
              {data.education.filter((e) => !e.isHidden).map((e) => (
                <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                  <span>{e.year}</span>
                  <span>{e.school}</span>
                  <span className="text-gray-600">{e.degree}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {skillTagList.length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">技能标签</h2>
            <div className="flex flex-wrap gap-2">
              {skillTagList.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">{tag}</span>
              ))}
            </div>
          </section>
        )}

        {data.basics.summary && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">个人亮点</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.basics.summary}</p>
          </section>
        )}

        {data.projects.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">项目经验</h2>
            <div className="space-y-4">
              {data.projects.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span>{p.duration}</span>
                    <span>{p.name}</span>
                    <span>{p.role}</span>
                  </div>
                  {p.technologies && <div className="text-gray-500 mb-1">技术栈：{p.technologies}</div>}
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.awards && data.awards.filter((a) => !a.isHidden).length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">获奖情况</h2>
            <div className="space-y-2 text-sm">
              {data.awards.filter((a) => !a.isHidden).map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between font-bold"><span>{a.name}</span><span className="text-gray-500 font-medium">{a.date}</span></div>
                  {a.description && <p className="text-gray-600 whitespace-pre-wrap mt-1">{a.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.certifications && data.certifications.filter((c) => !c.isHidden).length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">资格证书</h2>
            <div className="space-y-2 text-sm">
              {data.certifications.filter((c) => !c.isHidden).map((c) => (
                <div key={c.id} className="flex justify-between"><span className="font-bold">{c.name}</span><span className="text-gray-500">{c.date}</span></div>
              ))}
            </div>
          </section>
        )}

        {data.portfolio && data.portfolio.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">作品集</h2>
            <div className="space-y-2 text-sm">
              {data.portfolio.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id}>
                  <div className="font-bold">{p.title}</div>
                  {p.link && <a href={p.link} className="text-blue-600 break-all" target="_blank" rel="noopener noreferrer">{p.link}</a>}
                  {p.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.hobbies && !skillTagList.length && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">兴趣爱好</h2>
            <p className="text-sm text-gray-700">{data.hobbies}</p>
          </section>
        )}
        {data.hobbies && skillTagList.length > 0 && (
          <p className="text-sm text-gray-600"><span className="font-bold text-gray-800">兴趣爱好：</span>{data.hobbies}</p>
        )}
        {data.skills && skillTagList.length === 0 && (
          <section>
            <h2 className="inline-block bg-[#1e3a5f] text-white text-sm font-bold px-4 py-1.5 rounded-r-xl mb-3">专业技能</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.skills}</p>
          </section>
        )}
      </div>
    </div>
  );

  // 模板 7: 清新卡片 — 浅蓝底 + 白卡片 + 「//」标题线
  const SectionSlash = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[#3b82f6] font-black tracking-tighter text-lg">//</span>
      <h2 className="text-base font-bold text-gray-900 whitespace-nowrap">{title}</h2>
      <div className="flex-1 h-px bg-[#93c5fd]" />
    </div>
  );

  const renderTemplate7 = () => (
    <div className="bg-[#c8d6f0] text-gray-800 font-sans w-full max-w-[800px] min-h-[800px] md:min-h-[1131px] mx-auto shadow-lg print:shadow-none print:m-0 break-words">
      <div className="px-5 md:px-8 pt-6 pb-3 flex items-start gap-4 relative overflow-hidden">
        <div className="absolute right-4 top-8 text-5xl md:text-7xl font-black text-white/40 tracking-widest select-none pointer-events-none">RESUME</div>
        <div className="flex-1 relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{data.basics.name || '姓名'}</h1>
          <div className="h-px bg-gray-400/50 mb-3 max-w-xs" />
          <div className="text-xs text-gray-600 mb-3 flex flex-wrap gap-x-2">
            {data.basics.gender && <span>{data.basics.gender}</span>}
            {data.basics.age && <span>{data.basics.age}</span>}
            {eduDegree() && <span>{eduDegree()}</span>}
            {data.basics.workYears && <span>| {data.basics.workYears}</span>}
            {data.jobIntention?.targetJob && <span>| {data.jobIntention.targetJob}</span>}
          </div>
          <div className="space-y-1.5 text-sm text-gray-700">
            {data.basics.phone && (
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] flex items-center justify-center shrink-0">☎</span>
                {data.basics.phone}
              </div>
            )}
            {data.basics.email && (
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] flex items-center justify-center shrink-0">✉</span>
                <span className="break-all">{data.basics.email}</span>
              </div>
            )}
            {(data.basics.residence || data.jobIntention?.targetCity) && (
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3b82f6] text-white text-[10px] flex items-center justify-center shrink-0">📍</span>
                {data.basics.residence || data.jobIntention?.targetCity}
              </div>
            )}
          </div>
        </div>
        {data.basics.avatar ? (
          <img src={data.basics.avatar} alt="Avatar" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow relative z-10 shrink-0" />
        ) : (
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white shadow flex items-center justify-center text-2xl font-bold text-[#3b82f6] relative z-10 shrink-0">
            {(data.basics.name || '名')[0]}
          </div>
        )}
      </div>

      <div className="mx-3 md:mx-5 mb-5 bg-white rounded-2xl p-5 md:p-7 shadow-sm space-y-5">
        {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
          <section>
            <SectionSlash title="求职期望" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {data.jobIntention.targetJob && <span>{data.jobIntention.targetJob}</span>}
              {data.jobIntention.targetCity && <span>{data.jobIntention.targetCity}</span>}
              {data.jobIntention.expectedSalary && <span>{data.jobIntention.expectedSalary}</span>}
            </div>
          </section>
        )}

        {data.work.filter((w) => !w.isHidden).length > 0 && (
          <section>
            <SectionSlash title="工作经历" />
            <div className="space-y-4">
              {data.work.filter((w) => !w.isHidden).map((w) => (
                <div key={w.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold text-gray-900 mb-1">
                    <span>{w.duration}</span>
                    <span>{w.company}</span>
                    <span>{w.position}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.education.filter((e) => !e.isHidden).length > 0 && (
          <section>
            <SectionSlash title="教育经历" />
            <div className="space-y-2">
              {data.education.filter((e) => !e.isHidden).map((e) => (
                <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                  <span>{e.year}</span>
                  <span>{e.school}</span>
                  <span className="text-gray-600">{e.degree}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(skillTagList.length > 0 || data.skills) && (
          <section>
            <SectionSlash title="技能标签" />
            {skillTagList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillTagList.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">{tag}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.skills}</p>
            )}
          </section>
        )}

        {data.basics.summary && (
          <section>
            <SectionSlash title="个人亮点" />
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.basics.summary}</p>
          </section>
        )}

        {data.projects.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <SectionSlash title="项目经验" />
            <div className="space-y-4">
              {data.projects.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span>{p.duration}</span>
                    <span>{p.name}</span>
                    <span>{p.role}</span>
                  </div>
                  {p.technologies && <div className="text-[#3b82f6] text-xs mb-1">{p.technologies}</div>}
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.awards && data.awards.filter((a) => !a.isHidden).length > 0 && (
          <section>
            <SectionSlash title="获奖情况" />
            <div className="space-y-2 text-sm">
              {data.awards.filter((a) => !a.isHidden).map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between font-bold"><span>{a.name}</span><span className="font-medium text-gray-500">{a.date}</span></div>
                  {a.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.certifications && data.certifications.filter((c) => !c.isHidden).length > 0 && (
          <section>
            <SectionSlash title="资格证书" />
            <div className="space-y-1 text-sm">
              {data.certifications.filter((c) => !c.isHidden).map((c) => (
                <div key={c.id} className="flex justify-between"><span className="font-bold">{c.name}</span><span className="text-gray-500">{c.date}</span></div>
              ))}
            </div>
          </section>
        )}

        {data.portfolio && data.portfolio.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <SectionSlash title="作品集" />
            <div className="space-y-2 text-sm">
              {data.portfolio.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id}>
                  <div className="font-bold">{p.title}</div>
                  {p.link && <a href={p.link} className="text-[#3b82f6] break-all" target="_blank" rel="noopener noreferrer">{p.link}</a>}
                  {p.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.hobbies && (
          <section>
            <SectionSlash title="兴趣爱好" />
            <p className="text-sm text-gray-700">{data.hobbies}</p>
          </section>
        )}
      </div>
    </div>
  );

  // 模板 8: 图标专业 — 圆形图标章节 + 右侧「简历」丝带
  const IconTitle = ({ icon, title }: { icon: string; title: string }) => (
    <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-gray-100">
      <span className="w-8 h-8 rounded-full bg-[#2563eb] text-white text-sm flex items-center justify-center shrink-0 shadow-sm">{icon}</span>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
    </div>
  );

  const renderTemplate8 = () => (
    <div className="bg-white text-gray-800 font-sans w-full max-w-[800px] min-h-[800px] md:min-h-[1131px] mx-auto shadow-lg print:shadow-none print:m-0 break-words relative overflow-hidden">
      <div className="absolute right-0 top-0 w-10 md:w-12 bg-[#2563eb] text-white text-center py-3 text-xs font-bold tracking-widest writing-vertical-rl" style={{ writingMode: 'vertical-rl' }}>
        简历
      </div>

      <header className="px-6 md:px-10 pt-7 pb-5 flex items-center gap-5 border-b border-gray-100 pr-14">
        {data.basics.avatar ? (
          <img src={data.basics.avatar} alt="Avatar" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-[#2563eb]/30 shrink-0" />
        ) : (
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-2xl font-bold shrink-0">
            {(data.basics.name || '名')[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{data.basics.name || '姓名'}</h1>
          <div className="text-xs text-gray-500 mb-2 flex flex-wrap gap-x-2">
            {data.basics.gender && <span>{data.basics.gender}</span>}
            {data.basics.age && <span>{data.basics.age}</span>}
            {eduDegree() && <span>{eduDegree()}</span>}
            {data.basics.workYears && <span>| {data.basics.workYears}</span>}
            {data.basics.residence && <span>| {data.basics.residence}</span>}
            {!data.basics.residence && data.jobIntention?.targetCity && <span>| {data.jobIntention.targetCity}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            {data.basics.phone && <span>☎ {data.basics.phone}</span>}
            {data.basics.email && <span className="break-all">✉ {data.basics.email}</span>}
          </div>
        </div>
      </header>

      <div className="px-6 md:px-10 py-6 space-y-5 pr-14">
        {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
          <section>
            <IconTitle icon="◎" title="求职期望" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {data.jobIntention.targetJob && <span>期望：{data.jobIntention.targetJob}</span>}
              {data.jobIntention.targetCity && <span>城市：{data.jobIntention.targetCity}</span>}
              {data.jobIntention.expectedSalary && <span>薪资：{data.jobIntention.expectedSalary}</span>}
            </div>
          </section>
        )}

        {data.work.filter((w) => !w.isHidden).length > 0 && (
          <section>
            <IconTitle icon="▣" title="工作经历" />
            <div className="space-y-4">
              {data.work.filter((w) => !w.isHidden).map((w) => (
                <div key={w.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span className="text-[#2563eb]">{w.duration}</span>
                    <span>{w.company}</span>
                    <span>{w.position}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.education.filter((e) => !e.isHidden).length > 0 && (
          <section>
            <IconTitle icon="🎓" title="教育经历" />
            <div className="space-y-2">
              {data.education.filter((e) => !e.isHidden).map((e) => (
                <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-bold text-[#2563eb]">{e.year}</span>
                  <span className="font-bold">{e.school}</span>
                  <span className="text-gray-600">{e.degree}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(skillTagList.length > 0 || data.skills) && (
          <section>
            <IconTitle icon="★" title="技能标签" />
            {skillTagList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-700">
                {skillTagList.map((tag) => (
                  <div key={tag} className="py-1">{tag}</div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.skills}</p>
            )}
          </section>
        )}

        {data.basics.summary && (
          <section>
            <IconTitle icon="♥" title="个人亮点" />
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.basics.summary}</p>
          </section>
        )}

        {data.projects.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <IconTitle icon="◆" title="项目经验" />
            <div className="space-y-4">
              {data.projects.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span className="text-[#2563eb]">{p.duration}</span>
                    <span>{p.name}</span>
                    <span>{p.role}</span>
                  </div>
                  {p.technologies && <div className="text-gray-500 text-xs mb-1">技术栈：{p.technologies}</div>}
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.awards && data.awards.filter((a) => !a.isHidden).length > 0 && (
          <section>
            <IconTitle icon="🏅" title="获奖情况" />
            <div className="space-y-2 text-sm">
              {data.awards.filter((a) => !a.isHidden).map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between font-bold"><span>{a.name}</span><span className="text-gray-500 font-medium">{a.date}</span></div>
                  {a.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.certifications && data.certifications.filter((c) => !c.isHidden).length > 0 && (
          <section>
            <IconTitle icon="📜" title="资格证书" />
            <div className="space-y-1 text-sm">
              {data.certifications.filter((c) => !c.isHidden).map((c) => (
                <div key={c.id} className="flex justify-between"><span className="font-bold">{c.name}</span><span className="text-gray-500">{c.date}</span></div>
              ))}
            </div>
          </section>
        )}

        {data.portfolio && data.portfolio.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <IconTitle icon="🖼" title="作品集" />
            <div className="space-y-2 text-sm">
              {data.portfolio.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id}>
                  <div className="font-bold">{p.title}</div>
                  {p.link && <a href={p.link} className="text-[#2563eb] break-all" target="_blank" rel="noopener noreferrer">{p.link}</a>}
                  {p.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.hobbies && (
          <section>
            <IconTitle icon="♫" title="兴趣爱好" />
            <p className="text-sm text-gray-700">{data.hobbies}</p>
          </section>
        )}
      </div>
    </div>
  );

  // 模板 9: 斜切标签 — 居中头像卡片 + 斜切色块章节标题
  const CutTab = ({ title }: { title: string }) => (
    <div className="flex items-stretch mb-3">
      <div
        className="bg-[#1a2744] text-white text-sm font-bold px-4 py-1.5"
        style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
      >
        {title}
      </div>
      <div className="flex-1 border-b border-gray-200 self-end mb-0.5" />
    </div>
  );

  const renderTemplate9 = () => (
    <div className="bg-white text-gray-800 font-sans w-full max-w-[800px] min-h-[800px] md:min-h-[1131px] mx-auto shadow-lg print:shadow-none print:m-0 break-words overflow-hidden">
      <div className="bg-[#1a2744] h-28 md:h-32 relative">
        <div className="absolute left-1/2 -translate-x-1/2 top-10 md:top-12 flex flex-col items-center w-[90%] max-w-md">
          {data.basics.avatar ? (
            <img src={data.basics.avatar} alt="Avatar" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-lg z-10" />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white border-4 border-white shadow-lg z-10 flex items-center justify-center text-2xl font-bold text-[#1a2744]">
              {(data.basics.name || '名')[0]}
            </div>
          )}
          <div className="bg-white rounded-xl shadow-md w-full -mt-10 pt-12 pb-4 px-5 text-center">
            <h1 className="text-xl md:text-2xl font-bold mb-1">{data.basics.name || '姓名'}</h1>
            <div className="text-xs text-gray-500 mb-2 flex flex-wrap justify-center gap-x-2">
              {data.basics.gender && <span>{data.basics.gender}</span>}
              {data.basics.age && <span>{data.basics.age}</span>}
              {eduDegree() && <span>{eduDegree()}</span>}
              {data.basics.workYears && <span>| {data.basics.workYears}</span>}
            </div>
            <div className="space-y-1 text-xs md:text-sm text-gray-600">
              {data.basics.phone && <div>☎ {data.basics.phone}</div>}
              {data.basics.email && <div className="break-all">✉ {data.basics.email}</div>}
              {(data.basics.residence || data.jobIntention?.targetCity) && (
                <div>📍 {data.basics.residence || data.jobIntention?.targetCity}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 pt-36 md:pt-40 pb-6 space-y-5">
        {data.jobIntention && (data.jobIntention.targetJob || data.jobIntention.targetCity || data.jobIntention.expectedSalary) && (
          <section>
            <CutTab title="求职期望" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {data.jobIntention.targetJob && <span>期望：{data.jobIntention.targetJob}</span>}
              {data.jobIntention.targetCity && <span>城市：{data.jobIntention.targetCity}</span>}
              {data.jobIntention.expectedSalary && <span>薪资：{data.jobIntention.expectedSalary}</span>}
            </div>
          </section>
        )}

        {data.work.filter((w) => !w.isHidden).length > 0 && (
          <section>
            <CutTab title="工作经历" />
            <div className="space-y-4">
              {data.work.filter((w) => !w.isHidden).map((w) => (
                <div key={w.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span>{w.duration}</span>
                    <span>{w.company}</span>
                    <span>{w.position}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{w.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.education.filter((e) => !e.isHidden).length > 0 && (
          <section>
            <CutTab title="教育经历" />
            <div className="space-y-2">
              {data.education.filter((e) => !e.isHidden).map((e) => (
                <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                  <span>{e.year}</span>
                  <span>{e.school}</span>
                  <span className="text-gray-600">{e.degree}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(skillTagList.length > 0 || data.skills) && (
          <section>
            <CutTab title="技能标签" />
            {skillTagList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skillTagList.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-xs">{tag}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.skills}</p>
            )}
          </section>
        )}

        {data.basics.summary && (
          <section>
            <CutTab title="个人亮点" />
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.basics.summary}</p>
          </section>
        )}

        {data.projects.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <CutTab title="项目经验" />
            <div className="space-y-4">
              {data.projects.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id} className="text-sm">
                  <div className="flex flex-wrap justify-between gap-1 font-bold mb-1">
                    <span>{p.duration}</span>
                    <span>{p.name}</span>
                    <span>{p.role}</span>
                  </div>
                  {p.technologies && <div className="text-gray-500 text-xs mb-1">技术栈：{p.technologies}</div>}
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.awards && data.awards.filter((a) => !a.isHidden).length > 0 && (
          <section>
            <CutTab title="获奖情况" />
            <div className="space-y-2 text-sm">
              {data.awards.filter((a) => !a.isHidden).map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between font-bold"><span>{a.name}</span><span className="text-gray-500 font-medium">{a.date}</span></div>
                  {a.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.certifications && data.certifications.filter((c) => !c.isHidden).length > 0 && (
          <section>
            <CutTab title="资格证书" />
            <div className="space-y-1 text-sm">
              {data.certifications.filter((c) => !c.isHidden).map((c) => (
                <div key={c.id} className="flex justify-between"><span className="font-bold">{c.name}</span><span className="text-gray-500">{c.date}</span></div>
              ))}
            </div>
          </section>
        )}

        {data.portfolio && data.portfolio.filter((p) => !p.isHidden).length > 0 && (
          <section>
            <CutTab title="作品集" />
            <div className="space-y-2 text-sm">
              {data.portfolio.filter((p) => !p.isHidden).map((p) => (
                <div key={p.id}>
                  <div className="font-bold">{p.title}</div>
                  {p.link && <a href={p.link} className="text-[#1a2744] break-all" target="_blank" rel="noopener noreferrer">{p.link}</a>}
                  {p.description && <p className="text-gray-600 mt-1 whitespace-pre-wrap">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.hobbies && (
          <section>
            <CutTab title="兴趣爱好" />
            <p className="text-sm text-gray-700">{data.hobbies}</p>
          </section>
        )}
      </div>
    </div>
  );

  const renderTemplate = () => {
    switch (templateId) {
      case 'template1':
        return renderTemplate1();
      case 'template2':
        return renderTemplate2();
      case 'template3':
        return renderTemplate3();
      case 'template4':
        return renderTemplate4();
      case 'template6':
        return renderTemplate6();
      case 'template7':
        return renderTemplate7();
      case 'template8':
        return renderTemplate8();
      case 'template9':
        return renderTemplate9();
      default:
        return renderTemplate1();
    }
  };

  return (
    <div id="resume-print-area" className="w-full overflow-x-auto bg-gray-200 print:p-0 print:bg-white">
      {/* {templateId === 'template2' ? renderTemplate2() : renderTemplate1()}  */}
      { renderTemplate() }
    </div>
  );
}
