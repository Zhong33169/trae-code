export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTimeRemaining(deadline: Date | string): {
  remaining: number;
  isTimeout: boolean;
  text: string;
} {
  const now = Date.now();
  const deadlineTime = new Date(deadline).getTime();
  const diff = deadlineTime - now;

  if (diff <= 0) {
    const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    let text = "";
    if (days > 0) {
      text = `已超时 ${days} 天 ${hours % 24} 小时`;
    } else {
      text = `已超时 ${hours} 小时`;
    }
    return {
      remaining: diff,
      isTimeout: true,
      text,
    };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  let text = "";
  if (days > 0) {
    text = `剩余 ${days} 天 ${hours % 24} 小时`;
  } else {
    text = `剩余 ${hours} 小时`;
  }

  return {
    remaining: diff,
    isTimeout: false,
    text,
  };
}
