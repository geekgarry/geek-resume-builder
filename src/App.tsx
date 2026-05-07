/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ResumeData, User, defaultResumeData, ResumeTemplate } from "./types";
import { storageService } from "./services/storage";
import { apiService } from "./services/api";
import { AnalysisModule } from "./components/AnalysisModule";
import { ResumeEditor } from "./components/ResumeEditor";
import { ResumePreview } from "./components/ResumePreview";
import { AuthModal } from "./components/AuthModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { UserCenter } from "./components/UserCenter";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { PPTMaker } from "./components/PPTMaker";
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
  List,
  ListCollapseIcon,
  ListEndIcon,
  ListChevronsDownUpIcon,
  ListChevronsUpDownIcon,
  CodeXml,
  FileCode
} from "lucide-react";

import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import html2pdf from "html2pdf.js";
// import { saveAs } from "file-saver";
// import * as FileSaver from 'file-saver';
// import { Document, Packer, Paragraph, TextRun } from "docx";

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
  // 增加以下状态：isDrawerOpen 用于控制侧边栏抽屉的显示，isTemplateModalOpen 用于控制简历模板选择弹框的显示，activePage 用于区分当前是简历编辑页还是分析页，以便在页面切换时进行相应的逻辑处理（例如提示用户正在运行的 AI 任务）。这些状态将帮助我们更好地管理 UI 的交互和用户体验。
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activePage, setActivePage] = useState<"builder" | "analysis" | "ppt">(
    "builder",
  );

  // 在 App 组件内部增加下载弹框状态：
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  // 增加 AI 任务管理相关状态和函数，包括后台任务列表、任务面板开关、离开确认对话框状态，以及 Worker 引用。通过这些状态和函数，可以在用户执行 AI 生成新简历的操作时，动态管理任务状态，并在用户尝试离开当前页面时弹出确认对话框，提示用户任务将继续在后台运行。
  type BackgroundTask = {
    id: string;
    title: string;
    status: 'running' | 'completed' | 'failed';
    message: string;
  };

  // Worker 引用，用于管理 Worker 实例的生命周期（例如终止 Worker）。当启动新的 AI 任务时，如果已有 Worker 在运行，会先终止旧的 Worker，确保不会有多个 Worker 同时运行导致资源浪费或冲突。
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<{
    target: 'builder' | 'analysis';
    active: boolean;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const templateRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const runningTasksCount = backgroundTasks.filter((t) => t.status === 'running').length;

  // 添加后台任务管理函数，包括添加任务、更新任务状态和移除任务。这些函数会被 startBackgroundTask 调用，以便在 AI 生成新简历的过程中动态管理任务状态，并在 UI 上显示相应的进度和结果。
  const addBackgroundTask = (task: BackgroundTask) => {
    setBackgroundTasks((prev) => [...prev, task]);
  };

  const updateBackgroundTask = (taskId: string, status: BackgroundTask['status'], message: string) => {
    setBackgroundTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status, message } : t)));
  };

  const removeBackgroundTask = (taskId: string) => {
    setBackgroundTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // 启动后台 AI 任务，创建 Worker 实例并监听消息，更新任务状态
  const startBackgroundTask = async (taskId: string, payload: any) => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    // 创建新的 Worker 实例，并将其引用保存在 workerRef 中，以便后续管理（例如终止 Worker）。Worker 的代码位于 src/workers/backgroundAITask.ts，这个 Worker 负责处理 AI 生成新简历的任务，接收来自主线程的消息，调用 aiService 进行分析和生成，然后将结果返回给主线程。
    const worker = new Worker(
      new URL('./workers/backgroundAITask.ts', import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    // 监听 Worker 消息，更新任务状态，当所有任务完成时自动关闭任务面板，并根据 Worker 返回的结果在主线程中调用 API 保存生成的新简历。Worker 通过 postMessage 将结果发送回主线程，主线程根据结果更新 UI 状态，并在任务完成后终止 Worker 实例，释放资源。
    worker.onmessage = async (event) => {
      const { type, result } = event.data;
      if (type === 'AI_RESUME_TASK_RESULT') {
        if (result.success) {
          // 在主线程中调用 API 保存简历
          try {
            const newResume = await apiService.createResume(
              "AI优化的简历",
              result.data,
            );
            updateBackgroundTask(taskId, 'completed', 'AI 任务已完成，简历已保存');
            alert('AI优化的新简历已保存到您的简历列表中');
          } catch (err) {
            console.error(err);
            updateBackgroundTask(taskId, 'failed', '保存简历失败');
            alert('保存简历失败');
          }
        } else {
          updateBackgroundTask(taskId, 'failed', result.error || 'AI 生成新简历失败');
          alert(result.error || 'AI 生成新简历失败');
        }
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      updateBackgroundTask(taskId, 'failed', err.message || 'Worker出错');
      worker.terminate();
      workerRef.current = null;
      alert('AI 生成新简历失败');
    };

    worker.postMessage({
      type: 'START_AI_RESUME_TASK',
      payload,
    });
  };

  // 确认离开当前页面，切换到目标页面并保持任务面板打开
  const handleConfirmLeave = () => {
    if (!leaveConfirm) return;
    setActivePage(leaveConfirm.target);
    setLeaveConfirm(null);
    setTaskPanelOpen(true);
  };

  // 取消离开，继续等待任务完成
  const handleCancelLeave = () => {
    setLeaveConfirm(null);
  };

  // 监听后台任务状态，当所有任务完成时自动关闭任务面板
  useEffect(() => {
    if (runningTasksCount === 0 && taskPanelOpen && backgroundTasks.length > 0) {
      const timer = setTimeout(() => {
        setTaskPanelOpen(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [runningTasksCount, taskPanelOpen, backgroundTasks.length]);

  // 页面切换时，如果当前有正在运行的 AI 任务，弹出确认对话框，提示用户离开后任务将继续在后台运行，并询问是否确认离开当前页面。
  // 如果用户确认离开，则切换页面并保持任务面板打开；如果用户取消，则留在当前页面继续等待任务完成。
  const switchPage = (page: 'builder' | 'analysis') => {
    if (activePage === 'analysis' && page !== 'analysis' && runningTasksCount > 0) {
      setLeaveConfirm({ target: page, active: true });
      return;
    }
    setActivePage(page);
  };

  // 监听 Worker 消息，更新任务状态，当所有任务完成时自动关闭任务面板
  useEffect(() => {
    if (runningTasksCount > 0) setTaskPanelOpen(true);
  }, [runningTasksCount]);

  // 模板 modal 打开或当前模板切换时自动滚动至当前模板可见位置
  useEffect(() => {
    if (isTemplateModalOpen) {
      const target = templateRefs.current[currentTemplate];
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
    }
  }, [isTemplateModalOpen, currentTemplate]);

  // 监听 Worker 消息，更新任务状态
  useEffect(() => {
    if (backgroundTasks.every((task) => task.status !== 'running')) {
      setTaskPanelOpen(false);
    }
  }, [backgroundTasks]);

  // 加载简历模板列表，在用户切换到 app 视图时触发，避免在 admin 视图加载不必要的数据
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

        // 3. 临时样式修改（包括背景色修复）
        const originalStyles = {
          overflow: element.style.overflow,
          width: element.style.width,
          minWidth: element.style.minWidth,
          maxWidth: element.style.maxWidth,
          height: element.style.height,
          maxHeight: element.style.maxHeight,
          transform: element.style.transform,
          backgroundColor: element.style.backgroundColor,
        };

        const computedBackground = window.getComputedStyle(element).backgroundColor;
        if (computedBackground && computedBackground !== 'rgba(0, 0, 0, 0)') {
          element.style.backgroundColor = computedBackground;
        } else {
          element.style.backgroundColor = '#ffffff';
        }

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
          backgroundColor: element.style.backgroundColor || "#ffffff",
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
          onclone: (clonedDoc: Document) => {
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
          backgroundColor: element.style.backgroundColor,
        };

        const computedBackground = window.getComputedStyle(element).backgroundColor;
        if (computedBackground && computedBackground !== 'rgba(0, 0, 0, 0)') {
          element.style.backgroundColor = computedBackground;
        } else {
          element.style.backgroundColor = '#ffffff';
        }

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
          backgroundColor: element.style.backgroundColor || "#ffffff",
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
          currentTemplate,
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

  // 在你的 App.tsx 中，与 handleExportPDF 放在一起
  const handleExportHTML = async () => {
    setIsExporting(true);
    try {
      const container = document.getElementById('resume-print-area') ||
          document.getElementById("preview-container");
      if (!container) throw new Error('Container not found');
      
      // 获取简历本身的 DOM 内容
      const element = container.querySelector('div')?.cloneNode(true) as HTMLElement;
      if (!element) throw new Error('Element not found');

      // 1. 提取所有的 CSS 样式表 (内部和外部)
      let styles = '';
      const styleElements = document.querySelectorAll('style');
      styleElements.forEach(el => {
        styles += el.outerHTML + '\n';
      });

      // 尝试将外链 CSS 转换为内联 <style> (如果支持跨域)
      const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
      for (const link of Array.from(linkElements)) {
        try {
          const href = (link as HTMLLinkElement).href;
          if (href) {
            const res = await fetch(href);
            const cssText = await res.text();
            styles += `<style>\n${cssText}\n</style>\n`;
          }
        } catch (e) {
          console.warn('Fallback: keep link for', link.outerHTML);
          styles += link.outerHTML + '\n';
        }
      }

      // 2. 转换所有的图片为 base64 格式，确保独立/离线打开时图片不会丢失
      const images = element.querySelectorAll('img');
      for (const img of Array.from(images)) {
        try {
          if (img.src.startsWith('blob:') || img.src.startsWith('http')) {
            const res = await fetch(img.src);
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            img.src = base64;
          }
        } catch (e) {
          console.warn('Failed to inline image', img.src);
        }
      }

      // 3. 构建完整的单文件 HTML
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${resumeData?.basics?.name || '简历'} - resume</title>
      ${styles}
      <style>
        /* 独立打开时背景色与居中优化 */
        body {
          background-color: #525659; /* 模仿 PDF 阅读器深灰色底底 */
          display: flex;
          justify-content: center;
          padding: 40px 0;
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        #resume-print-area-wrapper {
          background-color: white;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          overflow: hidden;
          width: 800px;
          min-height: 1131px;
          margin: 0 auto;
        }
      </style>
      </head>
      <body>
      <div id="resume-print-area-wrapper">
        ${element.outerHTML}
      </div>
      </body>
      </html>`;

      // 4. 触发下载
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resumeData?.basics?.name || '简历'}-${new Date().getTime()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating HTML:', error);
      alert('导出 HTML 失败，请稍后重试');
    } finally {
      setIsExporting(false);
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
                <span className="hidden md:inline">模板</span>
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
                  {isExporting ? "生成中..." : "导出"}
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
              onClick={() => switchPage("builder")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePage === "builder" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              简历制作
            </button>
            <button
              onClick={() => switchPage("analysis")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePage === "analysis" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              岗位与行业分析
            </button>
            <button
              onClick={() => switchPage("ppt")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activePage === "ppt" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              AI PPT 生成
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
                switchPage("builder");
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
                switchPage("analysis");
                setIsDrawerOpen(false);
              }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left ${activePage === "analysis" ? "bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="flex items-center gap-3">
                <Briefcase size={18} /> 岗位与行业分析
              </span>
              <ChevronRight size={16} className="opacity-50" />
            </button>
            <button
              onClick={() => {
                switchPage("ppt");
                setIsDrawerOpen(false);
              }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left ${activePage === "ppt" ? "bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="flex items-center gap-3">
                <FileText size={18} /> AI PPT 生成
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
                  ref={(el) => { templateRefs.current[t.id] = el; }}
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
                  onClick={handleExportHTML}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    {/* <FileIcon size={24} /> */}
                    <FileCode size={24} />
                  </div>
                  <span className="font-medium text-gray-700">Html 简历</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 主体内容区：移动端上下布局，PC端左右布局max-w-7xl mx-auto  */}
      <main className="w-full mx-auto py-4 md:py-6 lg:px-4 py-4">
        {/* <main className="flex-1 flex flex-col md:flex-row overflow-hidden print:overflow-visible relative"> */}
        {/* 根据 activePage 状态切换显示简历编辑器、分析模块或PPT生成器 */}
        {activePage === "analysis" ? (
          // 分析模块，接收简历数据和任务状态回调函数，任务状态回调函数示例：onTaskStarted、onTaskProgress、onTaskComplete
          // 通过这些回调函数，分析模块可以通知父组件当前AI任务的状态，父组件再更新背景任务列表和UI显示
          <AnalysisModule
            resumeData={resumeData}
            onTaskStarted={(task) => addBackgroundTask({
              id: task.id,
              title: task.title,
              status: 'running',
              message: '任务正在启动',
            })}
            onTaskProgress={(taskId, status, message) => updateBackgroundTask(taskId, status as any, message)}
            onTaskComplete={(taskId, success, message) => updateBackgroundTask(taskId, success ? 'completed' : 'failed', message)}
            onStartBackgroundTask={startBackgroundTask}
            runningTasksCount={runningTasksCount}
          />
        ) : activePage === "ppt" ? (
          <PPTMaker resumeData={resumeData} />
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
                  template={templates.find((t) => t.id === currentTemplate)!}
                />
              </div>
            </div>

            {/* 预览区域 */}
            <div
              className="w-full lg:w-1/2 h-1/2 md:h-full overflow-y-auto bg-gray-200 print:w-full print:h-auto print:overflow-visible print:p-0 relative p-4"
              id="preview-container"
            >
              <ResumePreview
                data={resumeData}
                templateId={currentTemplate}
                template={templates.find((t) => t.id === currentTemplate)!}
              />
            </div>
          </div>
        )}
      </main>

      {/* 背景任务面板，用于显示正在运行的后台任务 */}
      {backgroundTasks.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-auto">
          <div className="w-full text-right">
            <button
              className="w-auto rounded-xl bg-blue-600 text-white px-3 py-2 text-sm font-medium shadow-lg hover:bg-blue-700"
              onClick={() => setTaskPanelOpen((prev) => !prev)}
              title={taskPanelOpen ? '点击关闭任务列表' : '点击展开任务列表'}
            >
              {/* {taskPanelOpen ? '收起任务' : `当前任务：${runningTasksCount} 正在运行`} */}
              {/* <List size={16} /> */}
              {taskPanelOpen ? <ListChevronsDownUpIcon size={16} /> : <ListChevronsUpDownIcon size={16} />}
            </button>
          </div>
          {taskPanelOpen && (
            <div className="w-72 mt-2 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
              <div className="p-2 text-xs text-gray-500 border-b border-gray-100">任务状态</div>
              <div className="max-h-56 overflow-y-auto">
                {backgroundTasks.map((task) => (
                  <div key={task.id} className="p-2 border-b border-gray-100" title={`状态: ${task.status}，详情: ${task.message}`}>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{task.title}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: task.status === 'running' ? '#34D399' : task.status === 'completed' ? '#3B82F6' : '#EF4444' }}>
                          {task.status}
                        </span>
                        {task.status !== 'running' && (
                          <button
                            className="text-red-500 hover:text-red-700 text-xs"
                            onClick={() => removeBackgroundTask(task.id)}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{task.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 确认离开对话框 */}
      <ConfirmDialog
        isOpen={leaveConfirm?.active ?? false}
        title="正在执行 AI 任务"
        message="AI任务仍在后台执行，离开后将生成悬浮任务窗口供查看。确认离开吗？"
        confirmText="离开并查看任务"
        cancelText="继续留在当前页面"
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />

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
