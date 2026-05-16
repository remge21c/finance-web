"use client";

import { ExternalLink, CheckCircle2, XCircle } from "lucide-react";

interface Group {
  id: string;
  name: string;
}

interface LogRow {
  id: string;
  group_id: string;
  trigger_type: "manual" | "cron";
  status: "success" | "failure";
  file_name: string | null;
  web_view_link: string | null;
  error_message: string | null;
  rotated_deleted: number;
  created_at: string;
}

interface Props {
  groups: Group[];
  logs: LogRow[];
}

export default function BackupHistoryTable({ groups, logs }: Props) {
  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

  if (logs.length === 0) {
    return <p className="text-sm text-gray-400">백업 이력이 아직 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3 font-medium">시각</th>
            <th className="py-2 pr-3 font-medium">그룹</th>
            <th className="py-2 pr-3 font-medium">유형</th>
            <th className="py-2 pr-3 font-medium">상태</th>
            <th className="py-2 pr-3 font-medium">파일</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const name = groupNameMap.get(log.group_id) ?? log.group_id.slice(0, 8);
            return (
              <tr key={log.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 pr-3 text-gray-800 font-medium">{name}</td>
                <td className="py-2 pr-3 text-gray-500">
                  {log.trigger_type === "cron" ? "자동" : "수동"}
                </td>
                <td className="py-2 pr-3">
                  {log.status === "success" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      성공
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-red-700"
                      title={log.error_message ?? undefined}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      실패
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {log.web_view_link ? (
                    <a
                      href={log.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:underline truncate max-w-[16rem]"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{log.file_name ?? "Drive 열기"}</span>
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">{log.error_message ?? "-"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
