/**
 * About - 关于我页面
 */

"use client";

import Image from "next/image";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import {
  Github,
  Twitter,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
} from "lucide-react";

const aboutContent = `
# 关于我

你好！我是 **petrel**，一名热爱技术也热爱生活的开发者。

这个博客是我记录技术成长、生活感悟、随笔、读书、电影感悟以及分享有趣事物的地方。

## 技能栈

- **Frontend**: HTML，CSS，JS，React, Vue, TypeScript, Tailwind CSS， Uniapp
- **Backend**: Node.js， Python， mysql
- **Infrastructure**: Docker,  Linux
- **Tools**: Vim, Git

## 个人格言

> 有的人活了10000天，而有的人只活了1天，重复了10000次。

## 联系我

如果你有任何问题或想进行技术交流，欢迎通过以下方式联系我：

- **Email**: [zhaohaiyan1123@gmail.com](mailto:zhaohaiyan1123@gmail.com) /  [zhaohaiyan2027@qq.com](mailto:zhaohaiyan2027@qq.com)
- **GitHub**: [Petrel](https://github.com/Petrel)
- **WeChat**: NZQR120
- **QQ**: 1207574452
`;

export default function About() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto p-8 max-w-7xl overflow-hidden"
    >
      <div className="flex flex-col md:flex-row gap-10 items-start">
        {/* Profile Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <Image
              src="https://picsum.photos/seed/avatar/400/400"
              alt="Avatar"
              width={400}
              height={400}
              className="relative w-full aspect-square rounded-2xl object-cover border-4 border-background"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-text-main">tl.s</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Full-stack Developer / Tech Enthusiast / Tea Lover
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <MapPin size={14} className="text-primary" />
                <span>Beijing, China</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <Briefcase size={14} className="text-primary" />
                <span>Software Engineer</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <GraduationCap size={14} className="text-primary" />
                <span>Computer Science</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <a
                href="#"
                className="p-2 rounded-lg bg-sidebar-active/20 dark:bg-sidebar-active/10 text-text-muted hover:text-primary transition-colors"
              >
                <Github size={18} />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-sidebar-active/20 dark:bg-sidebar-active/10 text-text-muted hover:text-primary transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-sidebar-active/20 dark:bg-sidebar-active/10 text-text-muted hover:text-primary transition-colors"
              >
                <Mail size={18} />
              </a>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 prose dark:prose-invert">
          <ReactMarkdown>{aboutContent}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
}
