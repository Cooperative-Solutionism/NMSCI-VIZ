export function formatRegistrationStatus(status: string | undefined): string {
  if (status === 'sent') return '已发送'
  if (status === 'failed') return '失败'
  return '-'
}
