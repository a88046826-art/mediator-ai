import { test, expect } from '@playwright/test';

test.describe('랜딩 페이지', () => {
  test('페이지 로드 및 핵심 UI 확인', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MEDIATOR|mediator|AI/i);
    // 랜딩 CTA 버튼 존재 확인
    const cta = page.getByRole('link', { name: /시작|회의|AI/i }).first();
    await expect(cta).toBeVisible();
  });
});

test.describe('회의 생성/참가 화면', () => {
  test('/ai 진입 시 createOrJoin 화면 표시', async ({ page }) => {
    await page.goto('/ai');
    await expect(page.getByPlaceholder(/이름/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /새 회의 만들기/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /회의 참가하기/i })).toBeVisible();
  });

  test('이름 없이 새 회의 만들기 클릭 시 오류 표시', async ({ page }) => {
    await page.goto('/ai');
    await page.getByRole('button', { name: /새 회의 만들기/i }).click();
    // 이름 없으면 toast 또는 다음 화면으로 넘어가지 않아야 함
    await expect(page.getByPlaceholder(/이름/i)).toBeVisible();
  });

  test('회의 참가하기 클릭 시 코드 입력창 표시', async ({ page }) => {
    await page.goto('/ai');
    await page.getByRole('button', { name: /회의 참가하기/i }).click();
    await expect(page.getByPlaceholder(/방 코드/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /취소/i })).toBeVisible();
  });

  test('존재하지 않는 방 코드 입력 시 오류 메시지', async ({ page }) => {
    await page.goto('/ai');
    await page.getByPlaceholder(/이름/i).fill('테스트유저');
    await page.getByRole('button', { name: /회의 참가하기/i }).click();
    await page.getByPlaceholder(/방 코드/i).fill('XXXXXX');
    await page.getByRole('button', { name: /^참가하기$/i }).click();
    // Firebase 미설정 환경에서는 오류 메시지 표시
    await expect(
      page.getByText(/존재하지 않|Firebase|오류|실패/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('히스토리 페이지', () => {
  test('/history 접근 가능', async ({ page }) => {
    await page.goto('/history');
    await expect(page).not.toHaveURL(/error/);
  });
});
