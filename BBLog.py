import tkinter as tk
from tkinter import TclError, ttk, Text
import datetime
import os
from supabase import create_client, Client

class BBBlog:
    def __init__(self):

        url: str = "https://pnrjiudqwzklmvdxmlxz.supabase.co"
        key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucmppdWRxd3prbG12ZHhtbHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAwNTQ1NjYsImV4cCI6MjAzNTYzMDU2Nn0.PjnBMGwSPqaW6Shez6xusYJfnKARVX7zstxrG71k7m4"
        # supabase: Client = create_client(url, key)
        supabase: Client = create_client(url, key)
        
        self.dbClient = supabase

        self.initialCommunications()

        self.root = tk.Tk()
        self.root.title('New Entry')
        self.root.resizable(0, 0)
        # self.categories = {"f":"g"}

        try:
            # windows only (remove the minimize/maximize button)
            self.root.attributes('-toolwindow', True)
        except TclError:
            print('Not supported on your platform')

        # layout on the root window
        self.root.columnconfigure(0, weight=4)
        self.root.columnconfigure(1, weight=1)

        input_frame = self.create_input_frame(self.root)
        input_frame.grid(column=0, row=0)

        button_frame = self.create_button_frame(self.root)
        button_frame.grid(column=0, row=1)
        self.root.mainloop()

    def initialCommunications(self):

        self.dbClient.auth.sign_in_with_password({"email": "ben.brutocao@gmail.com", "password": "BBBlogPass1029@"})

        response = self.dbClient.table("category") \
        .select("id","title").execute()
        print(response)
        self.categories = {}
        for category in response.data:
            self.categories[category['title']] = category['id']
        return 3

         
    def create_input_frame(self, container):

        frame = ttk.Frame(container)
        frame.grid(sticky=tk.W + tk.E)

        # Grid layout for the input frame
        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=3)

        # Title
        ttk.Label(frame, text='Title:').grid(column=0, row=0, sticky=tk.W)
        self.keyword = ttk.Entry(frame, width=30)
        self.keyword.focus()
        self.keyword.grid(column=1, row=0, sticky=tk.W)

        # Category
        self.selected_category = tk.StringVar()
        self.category_cb = ttk.Combobox(frame, textvariable=self.selected_category)
        self.category_cb['values'] = list(self.categories.keys())
        self.category_cb.grid(column=2, row=0, sticky=tk.W)
        self.category_cb['state'] = 'readonly'

        # Full Text
        self.full_text = tk.Text(frame, height=10, width=50)
        self.full_text.grid(column=0, row=1, columnspan=3, sticky=tk.W)

        for widget in frame.winfo_children():
            widget.grid(padx=5, pady=5)

        return frame
    


    def submit_entry(self):
        # print(self.categories[self.selected_category.get(1.0)])

        self.dbClient.auth.sign_in_with_password({"email": "ben.brutocao@gmail.com", "password": "BBBlogPass1029@"})

        print("hey girl")
        
        response = self.dbClient.table("post") \
        .insert({"category_id": self.categories[self.selected_category.get()],
                 "time_stamp" : datetime.datetime.now().isoformat(),
                 "title" : self.keyword.get(), 
                 "full_text" : self.full_text.get(1.0, "end-1c")}) \
        .execute()
        
        print(response)
        self.root.destroy()

        return 23

    def create_button_frame(self, container):
        frame = ttk.Frame(container)

        frame.columnconfigure(0, weight=1)

        ttk.Button(frame, text='Submit Text', command= lambda: self.submit_entry()).grid(column=0, row=0)


        for widget in frame.winfo_children():
            widget.grid(padx=5, pady=5)

        return frame




if __name__ == "__main__":
    BBBlog()
    os._exit(0)
