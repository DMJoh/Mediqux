import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

/**
 * Builds the standard list/one/create/update/delete hooks for a REST resource
 * (e.g. `/patients`). Reused across every CRUD page so each one only wires
 * up its own form fields and table columns.
 */
export function createResourceHooks(key, basePath) {
  function useList() {
    return useQuery({ queryKey: [key], queryFn: () => api.get(basePath) })
  }

  function useOne(id) {
    return useQuery({ queryKey: [key, id], queryFn: () => api.get(`${basePath}/${id}`), enabled: !!id })
  }

  function useCreate() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (data) => api.post(basePath, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
    })
  }

  function useUpdate() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({ id, data }) => api.put(`${basePath}/${id}`, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
    })
  }

  function useDelete() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (id) => api.del(`${basePath}/${id}`),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
    })
  }

  return { useList, useOne, useCreate, useUpdate, useDelete }
}
