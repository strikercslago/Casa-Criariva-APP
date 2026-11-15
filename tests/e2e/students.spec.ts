import { expect, test } from '@playwright/test'

type Student = {
  archived_at: string | null
  birth_date: string | null
  created_at: string
  created_by: string | null
  enrollment_date: string
  full_name: string
  id: string
  notes: string | null
  photo_path: string | null
  preferred_name: string | null
  status: 'active' | 'inactive' | 'archived'
  updated_at: string
}

type Guardian = {
  created_at: string
  email: string | null
  full_name: string
  id: string
  notes: string | null
  phone: string | null
  updated_at: string
}

test('manages students with mocked Supabase requests', async ({ page }) => {
  const consoleErrors: string[] = []
  const restRequests: string[] = []
  const storageRequests: string[] = []
  const authRequests: string[] = []
  const now = '2026-08-10T22:30:00.000Z'
  const userId = '11111111-1111-4111-8111-111111111111'
  let students: Student[] = []
  let guardians: Guardian[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.route('https://baugbpqdgslfogggaqen.supabase.co/auth/v1/**', async (route) => {
    authRequests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)

    await route.fulfill({
      contentType: 'application/json',
      json: {
        access_token: 'mock-access-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user: {
          app_metadata: {},
          aud: 'authenticated',
          confirmed_at: now,
          created_at: now,
          email: 'owner@example.com',
          id: userId,
          role: 'authenticated',
          updated_at: now,
          user_metadata: {},
        },
      },
      status: 200,
    })
  })

  await page.route('https://baugbpqdgslfogggaqen.supabase.co/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    restRequests.push(`${request.method()} ${url.pathname}`)

    if (url.pathname.endsWith('/profiles')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          avatar_url: null,
          created_at: now,
          full_name: 'Owner',
          id: userId,
          is_active: true,
          updated_at: now,
        },
        status: 200,
      })
      return
    }

    if (url.pathname.endsWith('/user_roles')) {
      await route.fulfill({
        contentType: 'application/json',
        json: [{ role: 'owner' }],
        status: 200,
      })
      return
    }

    if (url.pathname.includes('/rpc/get_dashboard_')) {
      await route.fulfill({ contentType: 'application/json', json: dashboardRows(url.pathname), status: 200 })
      return
    }

    if (url.pathname.endsWith('/rpc/complete_student_enrollment')) {
      const body = request.postDataJSON() as {
        payload: {
          guardians?: Array<{
            guardian?: { email: string | null; full_name: string; notes: string | null; phone: string | null }
            relationship: string
          }>
          student: Partial<Student>
        }
      }
      const student: Student = {
        archived_at: null,
        birth_date: body.payload.student.birth_date ?? null,
        created_at: now,
        created_by: userId,
        enrollment_date: body.payload.student.enrollment_date ?? '2026-03-05',
        full_name: body.payload.student.full_name ?? 'Aluno temporario',
        id: 'student-1',
        notes: body.payload.student.notes ?? null,
        photo_path: null,
        preferred_name: body.payload.student.preferred_name ?? null,
        status: 'active',
        updated_at: now,
      }
      students = [student, ...students]
      guardians =
        body.payload.guardians?.map((link, index) => ({
          created_at: now,
          email: link.guardian?.email ?? null,
          full_name: link.guardian?.full_name ?? `Responsavel ${index + 1}`,
          id: `guardian-${index + 1}`,
          notes: link.guardian?.notes ?? null,
          phone: link.guardian?.phone ?? null,
          updated_at: now,
        })) ?? []

      await route.fulfill({ contentType: 'application/json', json: student.id, status: 200 })
      return
    }

    if (url.pathname.endsWith('/classes')) {
      await route.fulfill({ contentType: 'application/json', json: [], status: 200 })
      return
    }

    if (url.pathname.endsWith('/guardians')) {
      await route.fulfill({ contentType: 'application/json', json: [], status: 200 })
      return
    }

    if (url.pathname.endsWith('/student_guardians')) {
      await route.fulfill({
        contentType: 'application/json',
        json: guardians.map((guardian, index) => ({
          can_pick_up: true,
          created_at: now,
          guardian,
          guardian_id: guardian.id,
          is_emergency_contact: true,
          is_financial_responsible: index === 0,
          is_primary_contact: index === 0,
          relationship: 'Mae',
          student_id: 'student-1',
        })),
        status: 200,
      })
      return
    }

    if (url.pathname.endsWith('/enrollments')) {
      await route.fulfill({ contentType: 'application/json', json: [], status: 200 })
      return
    }

    if (url.pathname.endsWith('/student_billing_plans')) {
      await route.fulfill({ contentType: 'application/json', json: [], status: 200 })
      return
    }

    if (url.pathname.endsWith('/attendance_records')) {
      await route.fulfill({ contentType: 'application/json', json: [], status: 200 })
      return
    }

    if (url.pathname.endsWith('/audit_events')) {
      await route.fulfill({
        contentType: 'application/json',
        json: students.length
          ? [
              {
                action: 'student.created',
                actor_user_id: userId,
                created_at: now,
                entity_id: 'student-1',
                entity_type: 'student',
                id: 'audit-1',
                metadata: {},
              },
            ]
          : [],
        status: 200,
      })
      return
    }

    if (url.pathname.endsWith('/students')) {
      const idFilter = url.searchParams.get('id')

      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Partial<Student>
        const student: Student = {
          archived_at: null,
          birth_date: body.birth_date ?? null,
          created_at: now,
          created_by: userId,
          enrollment_date: body.enrollment_date ?? '2026-03-05',
          full_name: body.full_name ?? 'Aluno temporario',
          id: 'student-1',
          notes: body.notes ?? null,
          photo_path: body.photo_path ?? null,
          preferred_name: body.preferred_name ?? null,
          status: body.status ?? 'active',
          updated_at: now,
        }
        students = [student, ...students]
        await route.fulfill({ contentType: 'application/json', json: student, status: 201 })
        return
      }

      if (request.method() === 'PATCH' && idFilter) {
        const id = idFilter.replace('eq.', '')
        const body = request.postDataJSON() as Partial<Student>
        students = students.map((student) =>
          student.id === id ? { ...student, ...body, updated_at: now } : student,
        )
        await route.fulfill({
          contentType: 'application/json',
          json: students.find((student) => student.id === id),
          status: 200,
        })
        return
      }

      if (idFilter) {
        const id = idFilter.replace('eq.', '')
        await route.fulfill({
          contentType: 'application/json',
          json: students.find((student) => student.id === id) ?? null,
          status: 200,
        })
        return
      }

      const statusFilter = url.searchParams.get('status')?.replace('eq.', '')
      const nameFilter = (url.searchParams.get('full_name')?.replace('ilike.', '') ?? url.searchParams.get('matching_classes.class.name')?.replace('ilike.', ''))?.replaceAll('%', '').toLowerCase()
      const filtered = students.filter((student) => {
        const matchesStatus = !statusFilter || student.status === statusFilter
        const matchesName = !nameFilter || student.full_name.toLowerCase().includes(nameFilter) || (student.id === 'student-2' && ('artes visuais'.includes(nameFilter) || 'responsavel bia'.includes(nameFilter)))

        return matchesStatus && matchesName
      })

      await route.fulfill({
        contentType: 'application/json',
        headers: { 'access-control-expose-headers': 'content-range', 'content-range': `0-${Math.max(filtered.length - 1, 0)}/${filtered.length}` },
        json: filtered.map((student) => ({ ...student, enrollments: student.id === 'student-2' ? [{ status: 'active', class: { name: 'Artes Visuais', class_schedules: [{ start_time: '09:00:00' }] } }] : [] })),
        status: 200,
      })
      return
    }

    await route.fulfill({ contentType: 'application/json', json: {}, status: 404 })
  })

  await page.route('https://baugbpqdgslfogggaqen.supabase.co/storage/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    storageRequests.push(`${request.method()} ${url.pathname}`)

    if (url.pathname.includes('/object/student-photos/')) {
      const objectPath = url.pathname.split('/object/student-photos/')[1] ?? 'student-1/avatar-test.webp'
      await route.fulfill({
        contentType: 'application/json',
        json: { Key: `student-photos/${objectPath}` },
        status: 200,
      })
      return
    }

    if (url.pathname.includes('/object/sign/student-photos/')) {
      await route.fulfill({
        contentType: 'application/json',
        json: { signedURL: '/mock-student-photo.webp' },
        status: 200,
      })
      return
    }

    await route.fulfill({ contentType: 'application/json', json: {}, status: 200 })
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha').fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('heading', { name: 'Menu Principal' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Módulos da escola' }).getByRole('link', { exact: true, name: 'Alunos' }).click()
  await expect(page.getByRole('heading', { name: 'Alunos' })).toBeVisible()
  await expect(page.getByText('Nenhum aluno cadastrado ainda.')).toBeVisible()

  await page.getByRole('button', { name: 'Novo aluno' }).click()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Selecionar foto' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64',
    ),
    mimeType: 'image/png',
    name: 'foto-aluno.png',
  })
  await page.getByLabel(/^Nome completo/).fill('Aluno E2E Temporario')
  await page.getByLabel('Nome preferido').fill('E2E')
  await page.getByLabel(/^Data de matricula/).fill('2026-03-05')
  await page.getByLabel('Observacoes internas').fill('Criado por teste isolado.')
  await page.getByRole('button', { name: 'Proximo' }).click()
  await page.getByRole('button', { name: 'Adicionar responsavel' }).click()
  await page.getByLabel(/^Nome completo/).last().fill('Mae E2E')
  await page.getByLabel('Celular / WhatsApp *').fill('11999990000')
  await page.getByRole('button', { name: 'Proximo' }).click()
  await page.getByRole('button', { name: 'Proximo' }).click()
  await page.getByRole('button', { name: 'Proximo' }).click()
  await expect(page.getByRole('heading', { name: 'Responsaveis' })).toBeVisible()
  await page.getByRole('button', { name: 'Concluir matricula' }).click()

  await expect(page.getByText('Matricula concluida com sucesso.')).toBeVisible()
  await expect(page.getByText('Aluno E2E Temporario').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aluno E2E Temporario' })).toBeVisible()

  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cartões', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const requestsBeforeToggle = restRequests.length
  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  await expect(page.locator('.student-directory--list')).toBeVisible()
  await page.getByRole('button', { name: 'Cartões', exact: true }).click()
  await expect(page.locator('.student-directory--cards')).toBeVisible()
  expect(restRequests.length).toBe(requestsBeforeToggle)
  while (await page.getByRole('button', { name: 'Fechar aviso', exact: true }).count()) {
    await page.getByRole('button', { name: 'Fechar aviso', exact: true }).first().click()
  }
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.student-directory--cards')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/students-cards-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/students-list-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Cartões', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Opções de Aluno E2E Temporario' }).click()
  await expect(page.getByRole('button', { name: 'Arquivar aluno' })).toBeVisible()

  const replacePhotoChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Alterar foto' }).click()
  const replacePhotoChooser = await replacePhotoChooserPromise
  await replacePhotoChooser.setFiles({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64',
    ),
    mimeType: 'image/png',
    name: 'foto-aluno-nova.png',
  })
  await page.getByRole('button', { name: 'Confirmar foto' }).click()
  await expect(page.getByText('Foto do aluno atualizada.')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remover foto' }).click()
  await expect(page.getByText('Foto removida.')).toBeVisible()

  await page.getByText('Mais opções do aluno', { exact: true }).click()
  await page.getByRole('button', { name: 'Editar dados do aluno' }).click()
  await page.getByLabel(/^Nome completo/).fill('Aluno E2E Editado')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Aluno atualizado.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aluno E2E Editado' })).toBeVisible()

  if (!(await page.getByRole('button', { name: 'Arquivar aluno' }).isVisible())) {
    await page.getByText('Mais opções do aluno', { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Arquivar aluno' }).click()
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click()
  await expect(page.getByText('Aluno arquivado.')).toBeVisible()
  await expect(page.getByText('Arquivado').filter({ visible: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Fechar' }).first().click()
  await page.getByRole('button', { name: 'Filtros de alunos' }).click()
  await page.getByRole('tab', { name: 'Arquivados' }).click()
  await expect(page.getByText('Aluno E2E Editado').filter({ visible: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Abrir Aluno E2E Editado' }).filter({ visible: true }).first().click()
  await page.getByRole('button', { name: 'Restaurar aluno' }).click()
  await expect(page.getByText('Aluno restaurado.')).toBeVisible()
  await expect(page.getByText('Ativo').filter({ visible: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  students.push(...(['active', 'inactive', 'archived'] as const).map((status, index) => ({
    ...students[0], id: `student-${index + 2}`, full_name: ['Bia Teste', 'Carlos Teste', 'Diana Teste'][index], preferred_name: null, status,
  })))
  await page.getByRole('tab', { name: 'Todos', exact: true }).click()
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Alunos encontrados' }).getByRole('listitem')).toHaveCount(4)
  await expect(page.getByText('Artes Visuais · Manhã')).toBeVisible()
  await expect(page.locator('.student-indicator').first()).toContainText('4')
  await page.getByRole('button', { name: 'Filtros de alunos' }).click()
  while (await page.getByRole('button', { name: 'Fechar aviso', exact: true }).count()) {
    await page.getByRole('button', { name: 'Fechar aviso', exact: true }).first().click()
  }
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/students-cards-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/students-list-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Cartões', exact: true }).click()
  }
  for (const search of ['Bia', 'Artes Visuais', 'Responsavel Bia']) {
    await page.getByRole('searchbox', { name: 'Buscar aluno' }).fill(search)
    await expect(page.getByRole('list', { name: 'Alunos encontrados' }).getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Abrir Bia Teste' })).toBeVisible()
    await page.getByRole('button', { name: 'Lista', exact: true }).click()
    await expect(page.getByRole('searchbox', { name: 'Buscar aluno' })).toHaveValue(search)
    await expect(page.getByRole('button', { name: 'Abrir Bia Teste' })).toBeVisible()
    await page.getByRole('button', { name: 'Cartões', exact: true }).click()
  }
  await page.getByRole('searchbox', { name: 'Buscar aluno' }).fill('Sem correspondencia')
  await expect(page.getByText('Nenhum aluno encontrado para essa busca.')).toBeVisible()

  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Lista', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.student-directory--list')).toBeVisible()

  expect(authRequests.filter((request) => request.includes('/token'))).toHaveLength(1)
  expect(restRequests.filter((request) => request.includes('/students')).length).toBeGreaterThanOrEqual(6)
  expect(storageRequests.some((request) => request.startsWith('POST /storage/v1/object/student-photos/student-1/'))).toBe(true)
  expect(storageRequests.some((request) => request.startsWith('DELETE /storage/v1/object/student-photos'))).toBe(true)
  expect(consoleErrors).toEqual([])
})

function dashboardRows(pathname: string) {
  if (pathname.endsWith('/rpc/get_dashboard_today')) return [{ day_date: '2026-08-11', events_today_count: 0, expected_students: 0, next_event_id: '', next_event_name: '', next_event_start: '', next_session_class_name: '', next_session_expected_students: 0, next_session_id: '', next_session_start: '', pending_sessions_count: 0, sessions_count: 0 }]
  if (pathname.endsWith('/rpc/get_dashboard_attention')) return []
  return [{ active_classes_count: 0, active_students_count: 0, archived_students_count: 0, attendance_absent_count: 0, attendance_excused_count: 0, attendance_pending_sessions: 0, attendance_present_count: 0, attendance_rate: 0, available_spots: 0, cash_in: 0, cash_out: 0, class_active_enrollments: 0, class_occupancy_rate: 0, class_total_capacity: 0, full_classes_count: 0, low_stock_count: 0, net_students_change: 0, new_students_count: 0, next_event_date: '', next_event_id: '', next_event_name: '', out_of_stock_count: 0, overdue_billing_amount: 0, overdue_billing_count: 0, payable_amount: 0, receivable_amount: 0, reference_month: '2026-08-01', result_amount: 0, upcoming_events_count: 0 }]
}
