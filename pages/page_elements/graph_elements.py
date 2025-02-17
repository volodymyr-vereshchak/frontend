import pandas as pd
import plotly.express as px


def get_period_graph(df: pd.DataFrame, y_axis: str):
    fig = px.line(df, x="period", y=y_axis)
    fig.update_layout(plot_bgcolor="lightgray", paper_bgcolor="#1a1a1a", height=600)
    return fig
