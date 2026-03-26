/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ResumeData, User, defaultResumeData, ResumeTemplate } from "./types";
import { storageService } from "./services/storage";
import { apiService } from "./services/api";
import { ResumeEditor } from "./components/ResumeEditor";
import { ResumePreview } from "./components/ResumePreview";
import { AuthModal } from "./components/AuthModal";
import { UserCenter } from "./components/UserCenter";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { AnalysisModule } from "./components/AnalysisModule";
import {
  Download,
  LogIn,
  LogOut,
  Info,
  ShieldAlert,
  Backpack,
  User as UserIcon,
  Menu,
  X,
  LayoutTemplate,
  Briefcase,
  ChevronRight,
  FileText,
  FileIcon,
} from "lucide-react";

import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import html2pdf from "html2pdf";
import { saveAs } from "file-saver";
// import * as FileSaver from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from "docx";

export default function App() {
  const [currentView, setCurrentView] = useState<"app" | "admin">("app");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<string>("template1");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserCenterOpen, setIsUserCenterOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // 增加以下状态：
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activePage, setActivePage] = useState<"builder" | "analysis">(
    "builder",
  );

  // 在 App 组件内部增加下载弹框状态：
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  useEffect(() => {
    if (currentView === "app") {
      const loadTpls = async () => {
        const tpls = await apiService.getTemplates();
        setTemplates(tpls);
      };
      loadTpls();
    }
  }, [currentView]);

  const loadUserData = async () => {
    try {
      const resumes = await apiService.getResumes();
      if (resumes && resumes.length > 0) {
        setCurrentResumeId(resumes[0].id);
        setResumeData(resumes[0].data);
      } else {
        // Create a default resume
        const newResume = await apiService.createResume(
          "我的简历",
          defaultResumeData,
        );
        setCurrentResumeId(newResume.id);
        setResumeData(newResume.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          const user = await apiService.getMe();
          setCurrentUser(user);
          await loadUserData();
        } catch (err) {
          console.error(err);
          localStorage.removeItem("auth_token");
          setResumeData(storageService.getGuestData());
        }
      } else {
        // 游客模式，加载本地缓存
        setResumeData(storageService.getGuestData());
      }
    };
    init();
  }, []);

  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) || window.innerWidth <= 768;

  // 监听数据变化，自动保存 (实时草稿 + 延迟同步后端)
  const handleResumeChange = (newData: ResumeData) => {
    setResumeData(newData);

    // 实时保存到本地缓存（防止断电/刷新丢失）
    if (currentUser) {
      storageService.saveUserData(currentUser.id, newData); // 登录用户的本地草稿
    } else {
      storageService.saveGuestData(newData); // 游客的本地草稿
    }
  };

  useEffect(() => {
    if (!currentUser || !currentResumeId) return; // 游客不需要同步后端

    const syncToDb = async () => {
      setIsSaving(true);
      await apiService.updateResume(currentResumeId, { data: resumeData });
      setIsSaving(false);
    };

    // 延迟 1.5 秒同步到后端（减少请求频率）
    const timeoutId = setTimeout(syncToDb, 1500);
    return () => clearTimeout(timeoutId);
  }, [resumeData, currentUser, currentResumeId]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    // 登录后加载用户云端数据（如果为空则使用默认）
    loadUserData();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentResumeId(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    setCurrentTemplate("template1"); // 恢复默认模板
    setResumeData(defaultResumeData); // 清空数据或加载游客数据
  };

  const handleExportPDF = async (mode: "single" | "paginated") => {
    // 强制使用 HTML 转 PDF 以保证样式一致性，尤其是移动端设备上直接使用 window.print() 往往会因为样式适配问题导致 PDF 格式混乱。后续可根据设备特性优化导出方案。
    if (isMobile) {
      // 目前先统一使用 html-to-image + jsPDF 方案，后续可根据设备特性优化
      setIsExporting(true);
      try {
        const container =
          document.getElementById("resume-print-area") ||
          document.getElementById("preview-container");
        if (!container) {
          setIsExporting(false);
          return;
        }

        const element = container.firstElementChild as HTMLElement;
        if (!element) {
          setIsExporting(false);
          return;
        }

        // 记录原始状态
        const originalScrollX = window.scrollX;
        const originalScrollY = window.scrollY;
        window.scrollTo(0, 0);

        // 1. 修复：先处理图片资源，确保所有图片加载完成
        const images = element.querySelectorAll("img");
        const imagePromises = Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();

          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // 即使图片加载失败也继续
            // 设置超时，防止某些图片卡住
            setTimeout(resolve, 1000);
          });
        });

        // 等待图片加载
        await Promise.all(imagePromises);

        // 2. 关键修复：为图片元素添加跨域属性，避免html2canvas的跨域问题
        images.forEach((img) => {
          if (!img.hasAttribute("crossOrigin")) {
            img.setAttribute("crossOrigin", "anonymous");
          }
        });

        // 3. 临时样式修改
        const originalStyles = {
          overflow: element.style.overflow,
          width: element.style.width,
          minWidth: element.style.minWidth,
          maxWidth: element.style.maxWidth,
          height: element.style.height,
          maxHeight: element.style.maxHeight,
          transform: element.style.transform,
        };

        element.style.overflow = "visible";
        element.style.width = "800px";
        element.style.minWidth = "800px";
        element.style.maxWidth = "800px";
        element.style.height = "max-content";
        element.style.maxHeight = "none";
        element.style.transform = "none";

        // 修复父级容器的overflow
        const parentNodes: { el: HTMLElement; overflow: string }[] = [];
        let currentNode = element.parentElement;
        while (currentNode && currentNode !== document.body) {
          parentNodes.push({
            el: currentNode,
            overflow: currentNode.style.overflow,
          });
          currentNode.style.overflow = "visible";
          currentNode = currentNode.parentElement;
        }

        const targetHeight = element.scrollHeight;
        const targetWidth = 800;

        // 4. 关键修复：优化html2canvas配置，确保图片正常渲染
        const canvas = await htmlToImage.toCanvas(element, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width: targetWidth,
          height: targetHeight,
          windowWidth: targetWidth,
          windowHeight: targetHeight,
          useCORS: true, // 启用CORS支持
          allowTaint: true, // 允许污染画布（对某些图片资源必要）
          imageTimeout: 15000, // 增加图片加载超时时间
          scale: 2, // 使用scale替代pixelRatio获得更好的质量
          logging: false,
          style: {
            transform: "none",
            width: `${targetWidth}px`,
            minWidth: `${targetWidth}px`,
            maxWidth: `${targetWidth}px`,
            height: `${targetHeight}px`,
            maxHeight: "none",
            overflow: "visible",
          },
          // 修复：处理图片跨域的特殊配置
          onclone: (clonedDoc) => {
            // 确保克隆的元素中的图片也有crossOrigin属性
            const clonedImages = clonedDoc.querySelectorAll("img");
            clonedImages.forEach((img) => {
              if (!img.hasAttribute("crossOrigin")) {
                img.setAttribute("crossOrigin", "anonymous");
              }
              // 修复base64图片
              if (img.src.startsWith("data:image")) {
                img.removeAttribute("crossOrigin");
              }
            });
          },
        });

        // 5. 恢复样式
        Object.assign(element.style, originalStyles);
        parentNodes.forEach(({ el, overflow }) => {
          el.style.overflow = overflow;
        });
        window.scrollTo(originalScrollX, originalScrollY);

        // 6. 关键修复：生成单页PDF（不分页）
        const imgData = canvas.toDataURL("image/png", 1.0);

        if (mode === "single") {
          // 计算PDF尺寸
          const pdfWidth = 210; // A4宽度210mm
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

          // 替代方案：如果超长，使用html2pdf库
          if (pdfHeight > 14400) {
            const opt = {
              margin: 0,
              filename: `${resumeData?.basics?.name || "简历"}-${new Date().getTime()}.pdf`,
              image: { type: "png", quality: 1 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: 800,
                height: targetHeight,
                windowWidth: 800,
                windowHeight: targetHeight,
              },
              jsPDF: {
                unit: "mm",
                format: "a4",
                orientation: "portrait",
              },
            };

            await html2pdf().set(opt).from(element).save();
          } else {
            // 使用单页方案
            // 创建自定义尺寸的PDF
            const pdf = new jsPDF({
              orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
              unit: "mm",
              // 动态设置PDF高度，确保完整内容在一页内
              format: [pdfWidth, Math.max(pdfHeight, 297)], // 最小高度为A4高度(297mm)
            });

            // 添加完整图片到PDF
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, "", "FAST");

            // 保存PDF
            pdf.save(
              `${resumeData?.basics?.name || "简历"}-${new Date().getTime()}.pdf`,
            );
          }
        } else {
          // 6. 生成 PDF 并处理多页分页逻辑
          const imgData = canvas.toDataURL("image/jpeg", 1.0);
          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          // 根据 A4 纸比例计算图片在 PDF 中的总高度
          const pdfTotalHeight = (canvas.height * pdfWidth) / canvas.width;

          let heightLeft = pdfTotalHeight;
          let position = 0;

          // 渲染第一页
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfTotalHeight);
          heightLeft -= pageHeight;

          // 关键修复：如果内容高度超出一页 A4 纸，循环添加新页面 (解决长简历被截断的问题)
          while (heightLeft > 0) {
            position -= pageHeight; // 向上移动图片位置，展示下一页的内容
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfTotalHeight);
            heightLeft -= pageHeight;
          }
          // 保存PDF
          pdf.save(
            `${resumeData?.basics?.name || "简历"}-${new Date().getTime()}.pdf`,
          );
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("导出PDF失败，请稍后重试");
      } finally {
        setIsExporting(false);
      }
    } else {
      window.print();
    }
  };

  const handleIntelligentExportPDF = async (mode: "single" | "paginated" = "single") => {
    // 强制使用 HTML 转 PDF 以保证样式一致性，尤其是移动端设备上直接使用 window.print() 往往会因为样式适配问题导致 PDF 格式混乱。后续可根据设备特性优化导出方案。
    if (isMobile) {
      setIsExporting(true);
      try {
        const container = 
          document.getElementById("resume-print-area") ||
          document.getElementById("preview-container");
        if (!container) throw new Error("Container not found");

        const element = container.firstElementChild as HTMLElement;
        if (!element) throw new Error("Element not found");

        // 1. 记录并置顶滚动位置
        const originalScrollX = window.scrollX;
        const originalScrollY = window.scrollY;
        window.scrollTo(0, 0);

        // 2. 临时展开所有父级容器，防止截图不全
        const parentNodes: { el: HTMLElement; overflow: string }[] = [];
        let currentNode = element.parentElement;
        while (currentNode && currentNode !== document.body) {
          parentNodes.push({
            el: currentNode,
            overflow: currentNode.style.overflow,
          });
          currentNode.style.overflow = "visible";
          currentNode = currentNode.parentElement;
        }

        const originalStyles = {
          overflow: element.style.overflow,
          width: element.style.width,
          minWidth: element.style.minWidth,
          maxWidth: element.style.maxWidth,
          height: element.style.height,
          maxHeight: element.style.maxHeight,
          transform: element.style.transform,
        };

        element.style.overflow = "visible";
        element.style.width = "800px";
        element.style.minWidth = "800px";
        element.style.maxWidth = "800px";
        element.style.height = "max-content";
        element.style.maxHeight = "none";
        element.style.transform = "none";

        const targetHeight = element.scrollHeight;

        // 3. 生成长图 (主线程仅负责截图)
        const canvas = await htmlToImage.toCanvas(element, {
          pixelRatio: 3, // 视网膜级别清晰度
          backgroundColor: "#ffffff",
          width: 800,
          height: targetHeight,
          style: {
            transform: "none",
            width: "800px",
            height: `${targetHeight}px`,
            maxHeight: "none",
            overflow: "visible",
          },
        });

        // 恢复样式
        Object.assign(element.style, originalStyles);
        parentNodes.forEach(({ el, overflow }) => {
          el.style.overflow = overflow;
        });
        window.scrollTo(originalScrollX, originalScrollY);

        const imgData = canvas.toDataURL("image/png");
        const fileName = `${resumeData?.basics?.name || "简历"}-${new Date().getTime()}.pdf`;

        // 4. 启用 Web Worker 进行像素级智能分页和 PDF 组装，避免主线程卡死
        const worker = new Worker(
          new URL("./workers/pdfWorker.ts", import.meta.url),
          { type: "module" },
        );

        worker.onmessage = (e) => {
          if (e.data.status === "success") {
            const url = URL.createObjectURL(e.data.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = e.data.fileName;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            alert("导出 PDF 失败：" + e.data.error);
          }
          setIsExporting(false);
          worker.terminate();
        };

        worker.postMessage({
          imgData,
          pdfWidth: 210,
          pdfHeight: 297,
          marginY: 10,
          isPaginated: mode === "paginated",
          fileName,
        });
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("导出 PDF 失败，请稍后重试");
        setIsExporting(false);
      }
    } else {
      window.print();
    }
  };

  const handleDownloadWord = () => {
    alert("正在开发中，敬请期待！");
    // const container = document.getElementById('resume-print-area') || document.getElementById('preview-container');
    // // 克隆元素以避免修改原始内容
    // const clonedElement = container.cloneNode(true);
    // let htmlContent = `
    //   </head>
    //   <body>
    //       ${clonedElement.outerHTML}
    //   </body>
    //   </html>`;
    // // 创建Word文档
    //   const doc = new Document({
    //     sections: [{
    //       properties: {},
    //       children: [
    //         new Paragraph({
    //           children: [
    //             new TextRun(htmlContent)
    //           ]
    //         })
    //       ]
    //     }]
    //   });
    // //通过后台返回 的word文件流设置文件名并下载
    // let blob = new Blob([doc], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8' }); //application/vnd.openxmlformats-officedocument.wordprocessingml.document这里表示doc类型
    // //let blob = new Blob([htmlContent]);
    // //var file=new File(`${that.realName}的简历.html`, that.iframeWinResume, {type: "text/html;charset=utf-8"});
    // let s = saveAs(blob, `我的简历-${new Date().getTime()}.doc`);
  };

  if (currentView === "admin") {
    return <AdminDashboard onBack={() => setCurrentView("app")} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b px-4 md:px-6 py-3 flex flex-wrap justify-between items-center sticky top-0 z-40 shadow-sm print:hidden gap-4">
        <div className="flex items-center gap-2">
          {/* 移动端侧滑菜单按钮 */}
          <button
            title="切换菜单"
            className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsDrawerOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            IR
          </div>
          <h1 className="font-bold text-gray-800 sm:block text-[12px] md:text-[20px] lg:text-xl">
            即刻简历
          </h1>

          {/* 框架说明提示 */}
          {/* <div className="ml-2 md:ml-4 group relative flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 cursor-help">
            <Info size={14} className="mr-1" />
            <span className="hidden sm:inline">架构说明</span>
            <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              注：为保证在当前环境中提供完整可运行的项目，本系统采用 React 19 构建。其组件化思想、服务层分离（services/）、状态管理与 Vue 2/3 完全一致，可无缝迁移至 Vue 技术栈。
            </div>
          </div> */}
        </div>

        <div className="flex flex-auto items-center gap-2 md:gap-4">
          {/* 仅在简历构建页面显示模板选择按钮 */}
          {activePage === "builder" && (
            <div className="flex items-center gap-2">
              <button
                title="更换简历模板"
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-indigo-100 transition-colors text-sm md:text-sm font-medium"
              >
                <LayoutTemplate size={18} />
                <span className="hidden md:inline">更换模板</span>
              </button>

              <button
                title="简历下载"
                onClick={() => setIsDownloadModalOpen(true)}
                disabled={isExporting}
                className={`flex items-center gap-1 px-3 md:px-4 py-2 rounded-lg text-sm transition-colors shrink-0 ${isExporting ? "bg-gray-400 cursor-not-allowed text-white" : "bg-gray-800 text-white hover:bg-gray-700"}`}
              >
                {isExporting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Download size={16} />
                )}
                <span className="hidden sm:inline">
                  {isExporting ? "生成中..." : "导出 PDF"}
                </span>
              </button>
            </div>
          )}
          {!currentUser && (
            <span className="text-xs text-orange-500 ml-1 hidden sm:inline">
              登录解锁更多
            </span>
          )}

          {/* 桌面端导航菜单 */}
          <div className="hidden md:flex items-center gap-2 border-l pl-4 ml-2">
            <button
              onClick={() => setActivePage("builder")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePage === "builder" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              简历制作
            </button>
            <button
              onClick={() => setActivePage("analysis")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePage === "analysis" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              岗位与行业分析
            </button>
          </div>
        </div>
        <div className="flex flex-auto justify-end items-center gap-2 md:gap-4 overflow-x-auto">
          {/* <div className="flex items-center gap-2 mr-2 md:mr-4 border-r pr-2 md:pr-4 shrink-0">
            <span className="text-sm text-gray-500 hidden sm:inline">模板:</span>
            <select 
              value={currentTemplate} 
              onChange={(e) => setCurrentTemplate(e.target.value)}
              className="border rounded px-2 py-1 text-sm bg-gray-50 max-w-[120px] sm:max-w-none"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id} disabled={t.isVip && !currentUser}>
                  {t.name} {t.isVip ? '(VIP)' : ''}
                </option>
              ))}
            </select>
            {!currentUser && (
              <span className="text-xs text-orange-500 ml-1 hidden sm:inline">登录解锁更多</span>
            )}
          </div> */}

          {/* 下载按钮位置 */}

          {currentUser ? (
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {currentUser.role === "admin" && (
                <button
                  title="进入管理后台"
                  onClick={() => setCurrentView("admin")}
                  className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 md:px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                >
                  <ShieldAlert size={16} />{" "}
                  <span className="hidden sm:inline">管理后台</span>
                </button>
              )}
              <div className="text-sm hidden sm:block">
                <span className="text-gray-500">欢迎, </span>
                <span className="font-bold">{currentUser.username}</span>
                {isSaving && (
                  <span className="text-xs text-green-500 ml-2">已保存</span>
                )}
              </div>
              <button
                onClick={() => setIsUserCenterOpen(true)}
                className="text-gray-500 hover:text-blue-500 p-1"
                title="个人中心"
              >
                <UserIcon size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-500 p-1"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1 border border-blue-600 text-blue-600 px-3 md:px-4 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors shrink-0"
            >
              <LogIn size={16} />{" "}
              <span className="hidden sm:inline">登录 / 注册</span>
            </button>
          )}
        </div>
      </header>

      {/* 移动端侧滑抽屉 (Drawer) */}
      {/* {isDrawerOpen && ( fixed inset-0 z-50 flex 为了实现侧滑效果注释掉外层的判断和内部的fixed样式  */}
      <div className="md:hidden">
        {/* 抽屉遮罩层 (添加淡入淡出过渡) */}
        <div
          className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
            isDrawerOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
          onClick={() => setIsDrawerOpen(false)}
        ></div>
        {/* <div className="relative w-64 max-w-sm bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-left"> */}
        {/* 侧滑抽屉主体 (添加平滑位移过渡) */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
            isDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* 抽屉内部内容 */}
          <div className="p-4 border-b flex justify-between items-center bg-blue-50">
            <span className="font-bold text-blue-800 text-lg">即刻开始</span>
            <button
              title="关闭"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 text-gray-500 hover:bg-blue-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <button
              onClick={() => {
                setActivePage("builder");
                setIsDrawerOpen(false);
              }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left ${activePage === "builder" ? "bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="flex items-center gap-3">
                <FileText size={18} /> 简历制作
              </span>
              <ChevronRight size={16} className="opacity-50" />
            </button>
            <button
              onClick={() => {
                setActivePage("analysis");
                setIsDrawerOpen(false);
              }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left ${activePage === "analysis" ? "bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="flex items-center gap-3">
                <Briefcase size={18} /> 岗位与行业分析
              </span>
              <ChevronRight size={16} className="opacity-50" />
            </button>
          </div>
        </div>
      </div>
      {/* )} */}

      {/* 模板选择弹窗 (Modal) */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsTemplateModalOpen(false)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-in zoom-in-95">
            <div className="p-4 md:p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <LayoutTemplate /> 选择简历模板
              </h2>
              <button
                title="关闭"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-4">
              {templates.map((t) => (
                <button
                  disabled={t.isVip && !currentUser}
                  key={t.id}
                  onClick={() => {
                    setCurrentTemplate(t.id);
                    setIsTemplateModalOpen(false);
                  }}
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${currentTemplate === t.id ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
                >
                  <div className="w-16 h-20 bg-white border shadow-sm mb-3 flex items-center justify-center text-gray-300 rounded">
                    <LayoutTemplate size={24} />
                  </div>
                  <span
                    className={`text-sm font-medium ${currentTemplate === t.id ? "text-blue-700" : "text-gray-700"}`}
                  >
                    {t.name}
                  </span>
                  {t.isVip && (
                    <span className="mt-1 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      VIP {!currentUser && `*注册用户使用`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 简历下载选择弹窗： */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsDownloadModalOpen(false)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in zoom-in-95 p-6 text-center">
            <button
              title="关闭"
              onClick={() => setIsDownloadModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:bg-gray-100 rounded-full p-1"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-gray-800 mb-2">
              选择下载格式
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              PDF 格式适合直接发送和打印，Word 格式适合二次编辑。
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setIsDownloadModalOpen(false);
                  setTimeout(
                    () => handleIntelligentExportPDF("paginated"),
                    100,
                  ); // 延迟执行以确保弹窗关闭
                }}
                className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all group"
              >
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <span className="font-medium text-gray-700">
                  {isMobile && `(分页)`}PDF 文档
                </span>
              </button>

              {isMobile && (
                <button
                  onClick={() => {
                    setIsDownloadModalOpen(false);
                    setTimeout(() => handleIntelligentExportPDF("single"), 100); // 延迟执行以确保弹窗关闭
                  }}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <span className="font-medium text-gray-700">
                    (单页)PDF 文档
                  </span>
                </button>
              )}

              {!isMobile && (
                <button
                  onClick={handleDownloadWord}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileIcon size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Word 文档</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 主体内容区：移动端上下布局，PC端左右布局max-w-7xl mx-auto  */}
      <main className="w-full mx-auto py-4 md:py-6 lg:px-4 py-4">
        {/* <main className="flex-1 flex flex-col md:flex-row overflow-hidden print:overflow-visible relative"> */}
        {activePage === "analysis" ? (
          <AnalysisModule resumeData={resumeData} />
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden print:overflow-visible relative">
            {/* 编辑器区域 */}
            <div className="w-full lg:w-1/2 h-1/2 md:h-full overflow-y-auto border-b md:border-b-0 md:border-0 bg-white print:hidden">
              <div className="p-4 md:p-6 max-w-3xl mx-auto">
                {!currentUser && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                    <Info size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <strong>游客模式：</strong>
                      您的数据将临时保存在浏览器本地缓存中。建议{" "}
                      <button
                        onClick={() => setIsAuthModalOpen(true)}
                        className="underline font-bold"
                      >
                        登录或注册
                      </button>{" "}
                      账号，以便永久保存简历并解锁更多精美模板。
                      <br />
                      {/* <span className="text-xs text-blue-600 mt-1 block">💡 提示：输入用户名 <strong>admin</strong> 登录即可体验超级管理员后台功能。</span> */}
                    </div>
                  </div>
                )}
                <ResumeEditor
                  data={resumeData}
                  onChange={handleResumeChange}
                  template={templates.find((t) => t.id === currentTemplate)}
                />
              </div>
            </div>

            {/* 预览区域 */}
            <div
              className="w-full lg:w-1/2 h-1/2 md:h-full overflow-y-auto bg-gray-200 print:w-full print:h-auto print:overflow-visible relative p-4"
              id="preview-container"
            >
              <ResumePreview
                data={resumeData}
                templateId={currentTemplate}
                template={templates.find((t) => t.id === currentTemplate)}
              />
            </div>
          </div>
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {currentUser && isUserCenterOpen && (
        <UserCenter
          user={currentUser}
          onClose={() => setIsUserCenterOpen(false)}
          onUpdate={(user) => setCurrentUser(user)}
          currentResumeId={currentResumeId}
          onSelectResume={(id, data) => {
            setCurrentResumeId(id);
            setResumeData(data);
            setIsUserCenterOpen(false);
          }}
        />
      )}
    </div>
  );
}
