import React from 'react';
import { TransferTask } from '@/types/transfer';
import { IncomingRequest } from '@/hooks/useFileTransfer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatBytes, formatSpeed, formatTime } from '@/lib/format';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  HelpCircle,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

interface TransferProps {
  tasks: Record<string, TransferTask>;
  incomingRequest: IncomingRequest | null;
  onAccept: () => void;
  onReject: () => void;
  onCancel: (taskId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const statusBadgeClass = {
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'border-destructive/20 bg-destructive/10 text-destructive',
  paused: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  pending: 'border-primary/20 bg-primary/10 text-primary',
  transferring: 'border-primary/20 bg-primary/10 text-primary',
} as const;

export const Transfer: React.FC<TransferProps> = ({
  tasks,
  incomingRequest,
  onAccept,
  onReject,
  onCancel,
  isOpen,
  onClose
}) => {
  const taskList = Object.values(tasks)
    .filter(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'paused')
    .sort((a, b) => b.startedAt - a.startedAt);

  const renderStatusIcon = (task: TransferTask) => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 className="text-emerald-500" />;
      case 'failed':
        return <XCircle className="text-destructive" />;
      case 'paused':
        return <AlertCircle className="text-amber-500" />;
      default:
        return task.type === 'send'
          ? <Upload className="animate-bounce text-primary" />
          : <Download className="animate-bounce text-primary" />;
    }
  };

  const getETA = (task: TransferTask) => {
    if (task.status !== 'transferring' || task.speed === 0) return '估算中';
    const remainingBytes = task.fileSize - task.transferredBytes;
    const remainingSeconds = remainingBytes / task.speed;
    return formatTime(remainingSeconds);
  };

  const getStatusText = (task: TransferTask) => {
    if (task.status === 'completed') return '已完成';
    if (task.status === 'failed') return '失败';
    if (task.status === 'paused') return '已暂停';
    if (task.status === 'pending') return '待接收';
    return formatSpeed(task.speed);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-[420px] max-w-[calc(100vw-1.5rem)] bg-sidebar p-0 sm:max-w-[420px]">
          <SheetHeader className="border-b border-border/60 pr-14">
            <SheetTitle className="text-lg font-semibold tracking-tight">
              文件传输中心
            </SheetTitle>
            <SheetDescription>
              已载入 {taskList.length} 个实时传输任务
            </SheetDescription>
          </SheetHeader>

          <div className="px-6">
            <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">实时任务遥测</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  展示局域网发送和接收进度，包含速度、剩余时间和取消控制。
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-6">
            <div className="flex flex-col gap-3 pb-6">
              {taskList.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 text-center">
                  <Download className="mb-3 size-7 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">当前没有传输任务</p>
                  <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                    从雷达协作台选择设备并投递文件后，任务会出现在这里。
                  </p>
                </div>
              ) : (
                taskList.map(task => {
                  const isFailed = task.status === 'failed';
                  const progressTone = isFailed
                    ? 'bg-destructive'
                    : task.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-primary';

                  return (
                    <Card key={task.id} size="sm" className="rounded-xl border border-border/70 shadow-none">
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="[&_svg]:size-4">{renderStatusIcon(task)}</span>
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-semibold text-foreground" title={task.fileName}>
                                {task.fileName}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {formatBytes(task.fileSize)} · {task.type === 'send' ? `发给 ${task.peerName}` : `来自 ${task.peerName}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <Badge
                              variant="outline"
                              className={statusBadgeClass[task.status as keyof typeof statusBadgeClass] || statusBadgeClass.transferring}
                            >
                              {getStatusText(task)}
                            </Badge>
                            {task.status === 'transferring' && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="size-3" />
                                剩余 {getETA(task)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Progress value={task.progress} indicatorClassName={progressTone} className="h-1.5" />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>{task.progress}%</span>
                            <span>{formatBytes(task.transferredBytes)} / {formatBytes(task.fileSize)}</span>
                          </div>
                        </div>

                        {task.status !== 'completed' && task.status !== 'failed' && (
                          <Button
                            variant="destructive"
                            size="xs"
                            className="ml-auto"
                            onClick={() => onCancel(task.id)}
                          >
                            <X className="size-3" />
                            取消任务
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={!!incomingRequest}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[440px]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {incomingRequest && (
            <>
              <DialogHeader className="items-center text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                  <Download className="size-5 text-primary" />
                </div>
                <DialogTitle>收到文件互传请求</DialogTitle>
                <DialogDescription>
                  局域网内的 <span className="font-medium text-foreground">{incomingRequest.senderName}</span> 想要投递一个文件。
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className="break-all text-sm font-semibold text-foreground">
                  {incomingRequest.fileName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  文件大小: {formatBytes(incomingRequest.fileSize)}
                </p>
              </div>

              <DialogFooter className="gap-2 sm:justify-stretch">
                <Button className="flex-1" variant="outline" onClick={onReject}>
                  拒绝
                </Button>
                <Button className="flex-1" onClick={onAccept}>
                  接收并下载
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Transfer;
